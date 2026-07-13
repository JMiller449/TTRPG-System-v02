from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import logging
from dataclasses import asdict, dataclass
from typing import Any, Literal
from uuid import uuid4

from fastapi import WebSocket

from backend.features.auth.tokens import SERVICE_AUTH_CODE
from backend.features.chat.schema import (
    Roll20BridgeHello,
    Roll20ChatDelivery,
    Roll20ChatMessage,
    SendRoll20ChatMessage,
)
from backend.features.session.models import SessionRole, WebSocketSession
from backend.protocol.socket import Roll20BridgeStatusEvent
from backend.state.store import StateSingleton

logger = logging.getLogger(__name__)
DELIVERY_TIMEOUT_SECONDS = 12.0
BRIDGE_TOKEN_PREFIX = "ttrpg_bridge_v1"


@dataclass(frozen=True)
class Roll20BridgeBinding:
    key: str
    role: Literal["dm", "player"]
    label: str
    instance_id: str | None = None


def _encode_token_part(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _decode_token_part(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}")


def binding_from_key(binding_key: str) -> Roll20BridgeBinding | None:
    if binding_key == "dm":
        return Roll20BridgeBinding(key="dm", role="dm", label="DM")
    prefix = "instance:"
    if not binding_key.startswith(prefix):
        return None
    instance_id = binding_key[len(prefix) :]
    if not instance_id:
        return None
    state = StateSingleton.getState()
    instance = state.instanced_sheets.get(instance_id)
    sheet = state.sheets.get(instance.parent_id) if instance is not None else None
    if instance is None or sheet is None or sheet.dm_only:
        return None
    return Roll20BridgeBinding(
        key=binding_key,
        role="player",
        label=sheet.name,
        instance_id=instance_id,
    )


def binding_for_session(
    session: WebSocketSession,
    *,
    required: bool = True,
) -> Roll20BridgeBinding | None:
    if session.role == "dm":
        return binding_from_key("dm")
    if session.role == "player" and session.assigned_instance_id is not None:
        binding = binding_from_key(f"instance:{session.assigned_instance_id}")
        if binding is not None:
            return binding
    if required:
        raise PermissionError(
            "Claim a sheet access code before using the Roll20 bridge."
        )
    return None


def binding_for_actor(
    *,
    actor_role: SessionRole,
    assigned_instance_id: str | None,
) -> Roll20BridgeBinding:
    if actor_role == "dm":
        binding = binding_from_key("dm")
    elif actor_role == "player" and assigned_instance_id is not None:
        binding = binding_from_key(f"instance:{assigned_instance_id}")
    else:
        binding = None
    if binding is None:
        raise PermissionError(
            "Claim a sheet access code before using the Roll20 bridge."
        )
    return binding


def issue_bridge_token(binding: Roll20BridgeBinding) -> str:
    payload = _encode_token_part(
        json.dumps(
            {"binding_key": binding.key, "version": 1},
            separators=(",", ":"),
            sort_keys=True,
        ).encode("utf-8")
    )
    signature = _encode_token_part(
        hmac.new(
            SERVICE_AUTH_CODE.encode("utf-8"),
            payload.encode("ascii"),
            hashlib.sha256,
        ).digest()
    )
    return f"{BRIDGE_TOKEN_PREFIX}.{payload}.{signature}"


def authenticate_bridge_token(token: str) -> Roll20BridgeBinding | None:
    # Existing installations used the service code directly. Treat that legacy
    # credential as DM-scoped so deployment does not restore global routing.
    if token == SERVICE_AUTH_CODE:
        return binding_from_key("dm")
    try:
        prefix, payload, signature = token.split(".", 2)
        if prefix != BRIDGE_TOKEN_PREFIX:
            return None
        expected_signature = _encode_token_part(
            hmac.new(
                SERVICE_AUTH_CODE.encode("utf-8"),
                payload.encode("ascii"),
                hashlib.sha256,
            ).digest()
        )
        if not hmac.compare_digest(signature, expected_signature):
            return None
        decoded = json.loads(_decode_token_part(payload).decode("utf-8"))
    except (UnicodeDecodeError, ValueError, json.JSONDecodeError):
        return None
    if not isinstance(decoded, dict) or decoded.get("version") != 1:
        return None
    binding_key = decoded.get("binding_key")
    if not isinstance(binding_key, str):
        return None
    return binding_from_key(binding_key)


class Roll20ChatBridge:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._active_connections: dict[str, WebSocket] = {}
        self._connection_bindings: dict[WebSocket, str] = {}
        self._pending_deliveries: dict[
            str,
            tuple[str, WebSocket, asyncio.Future[Roll20ChatDelivery]],
        ] = {}

    def _fail_pending_for_connection(self, connection: WebSocket) -> None:
        for _, pending_connection, future in self._pending_deliveries.values():
            if pending_connection is connection and not future.done():
                future.set_result(
                    Roll20ChatDelivery(
                        message_id="bridge-disconnected",
                        success=False,
                        reason="unknown",
                        type="chat_delivery",
                    )
                )

    async def connect(
        self,
        websocket: WebSocket,
        *,
        binding_key: str = "dm",
        accept: bool = True,
    ) -> WebSocket | None:
        if accept:
            await websocket.accept()
        async with self._lock:
            previous_binding = self._connection_bindings.get(websocket)
            if (
                previous_binding is not None
                and self._active_connections.get(previous_binding) is websocket
            ):
                self._active_connections.pop(previous_binding, None)
            previous = self._active_connections.get(binding_key)
            self._active_connections[binding_key] = websocket
            self._connection_bindings[websocket] = binding_key
            if previous is not None and previous is not websocket:
                self._connection_bindings.pop(previous, None)
                self._fail_pending_for_connection(previous)
        return previous if previous is not websocket else None

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            binding_key = self._connection_bindings.pop(websocket, None)
            if (
                binding_key is not None
                and self._active_connections.get(binding_key) is websocket
            ):
                self._active_connections.pop(binding_key, None)
            self._fail_pending_for_connection(websocket)

    async def send(
        self,
        message: Roll20ChatMessage,
        *,
        binding_key: str = "dm",
        await_delivery: bool = False,
    ) -> None:
        future: asyncio.Future[Roll20ChatDelivery] | None = None
        async with self._lock:
            connection = self._active_connections.get(binding_key)
            if connection is not None and await_delivery:
                if message.message_id in self._pending_deliveries:
                    raise RuntimeError(
                        f"Roll20 chat message '{message.message_id}' is already pending."
                    )
                future = asyncio.get_running_loop().create_future()
                self._pending_deliveries[message.message_id] = (
                    binding_key,
                    connection,
                    future,
                )
        if connection is None:
            raise RuntimeError(
                "Roll20 chat bridge is not connected for this user."
            )

        try:
            await connection.send_json(asdict(message))
        except RuntimeError:
            await self.disconnect(connection)
            await broadcast_bridge_statuses()
            raise RuntimeError(
                "Roll20 chat bridge is not connected for this user."
            )

        if future is None:
            return

        try:
            delivery = await asyncio.wait_for(
                asyncio.shield(future),
                timeout=DELIVERY_TIMEOUT_SECONDS,
            )
        except TimeoutError as exc:
            raise RuntimeError("Roll20 chat delivery timed out.") from exc
        finally:
            async with self._lock:
                self._pending_deliveries.pop(message.message_id, None)
            if not future.done():
                future.cancel()

        if not delivery.success:
            reason = delivery.reason or "unknown"
            raise RuntimeError(f"Roll20 chat delivery failed: {reason}.")

    def acknowledge_delivery(
        self,
        event: Roll20ChatDelivery,
        *,
        websocket: WebSocket,
    ) -> bool:
        pending = self._pending_deliveries.get(event.message_id)
        if pending is None:
            return False
        _, pending_websocket, future = pending
        if pending_websocket is not websocket:
            return False
        if future.done():
            return False
        future.set_result(event)
        return True

    async def reset(self) -> None:
        async with self._lock:
            for connection in self._active_connections.values():
                self._fail_pending_for_connection(connection)
            self._active_connections.clear()
            self._connection_bindings.clear()
            self._pending_deliveries.clear()

    async def is_connected(self, binding_key: str = "dm") -> bool:
        async with self._lock:
            return binding_key in self._active_connections

    async def connected_binding_keys(self) -> frozenset[str]:
        async with self._lock:
            return frozenset(self._active_connections)

roll20_chat_bridge = Roll20ChatBridge()


def build_bridge_status_event(
    session: WebSocketSession,
    *,
    connected_binding_keys: frozenset[str],
    request_id: str | None = None,
) -> Roll20BridgeStatusEvent:
    binding = binding_for_session(session, required=False)
    return Roll20BridgeStatusEvent(
        response_id=None,
        connected=(
            binding is not None and binding.key in connected_binding_keys
        ),
        binding_key=binding.key if binding is not None else None,
        binding_label=binding.label if binding is not None else None,
        request_id=request_id,
    )


async def bridge_status_event_for_session(
    session: WebSocketSession,
    *,
    request_id: str | None = None,
) -> Roll20BridgeStatusEvent:
    return build_bridge_status_event(
        session,
        connected_binding_keys=await roll20_chat_bridge.connected_binding_keys(),
        request_id=request_id,
    )


async def broadcast_bridge_statuses() -> None:
    from backend.features.session.service import websocket_sessions

    connected_binding_keys = await roll20_chat_bridge.connected_binding_keys()
    await websocket_sessions.broadcast_per_session(
        lambda session: build_bridge_status_event(
            session,
            connected_binding_keys=connected_binding_keys,
        )
    )


def build_chat_message(request: SendRoll20ChatMessage) -> Roll20ChatMessage:
    return Roll20ChatMessage(
        message_id=str(uuid4()),
        message=request.message,
        request_id=request.request_id,
    )


def parse_bridge_event(payload: Any) -> Roll20BridgeHello | Roll20ChatDelivery:
    if not isinstance(payload, dict):
        raise ValueError("Roll20 bridge payload must be an object.")

    event_type = payload.get("type")
    if event_type == "hello":
        return Roll20BridgeHello.model_validate(payload)
    if event_type == "chat_delivery":
        return Roll20ChatDelivery.model_validate(payload)
    raise ValueError(f"Unknown Roll20 bridge payload type: {event_type}")


def handle_bridge_event(
    event: Roll20BridgeHello | Roll20ChatDelivery,
    *,
    websocket: WebSocket,
    binding: Roll20BridgeBinding,
) -> None:
    if isinstance(event, Roll20BridgeHello):
        logger.info(
            "Roll20 bridge connected from %s for %s",
            event.source,
            binding.key,
        )
        return

    acknowledged = roll20_chat_bridge.acknowledge_delivery(
        event,
        websocket=websocket,
    )
    if event.success:
        logger.info("Roll20 chat message delivered: %s", event.message_id)
        return

    logger.warning(
        "Roll20 chat message delivery failed for %s (%s)%s",
        event.message_id,
        event.reason or "unknown",
        "" if acknowledged else " without a pending request",
    )
