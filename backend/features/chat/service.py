from __future__ import annotations

import asyncio
import logging
from dataclasses import asdict
from typing import Any
from uuid import uuid4

from fastapi import WebSocket

from backend.features.chat.schema import (
    Roll20BridgeHello,
    Roll20ChatDelivery,
    Roll20ChatMessage,
    SendRoll20ChatMessage,
)
from backend.protocol.socket import Roll20BridgeStatusEvent

logger = logging.getLogger(__name__)
DELIVERY_TIMEOUT_SECONDS = 12.0


class Roll20ChatBridge:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._active_connection: WebSocket | None = None
        self._pending_deliveries: dict[
            str,
            tuple[WebSocket, asyncio.Future[Roll20ChatDelivery]],
        ] = {}

    def _fail_pending_for_connection(self, connection: WebSocket) -> None:
        for pending_connection, future in self._pending_deliveries.values():
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
        accept: bool = True,
    ) -> WebSocket | None:
        if accept:
            await websocket.accept()
        async with self._lock:
            previous = self._active_connection
            self._active_connection = websocket
            if previous is not None and previous is not websocket:
                self._fail_pending_for_connection(previous)
        return previous if previous is not websocket else None

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            if self._active_connection is websocket:
                self._active_connection = None
            self._fail_pending_for_connection(websocket)

    async def send(
        self,
        message: Roll20ChatMessage,
        *,
        await_delivery: bool = False,
    ) -> None:
        future: asyncio.Future[Roll20ChatDelivery] | None = None
        async with self._lock:
            connection = self._active_connection
            if connection is not None and await_delivery:
                if message.message_id in self._pending_deliveries:
                    raise RuntimeError(
                        f"Roll20 chat message '{message.message_id}' is already pending."
                    )
                future = asyncio.get_running_loop().create_future()
                self._pending_deliveries[message.message_id] = (connection, future)
        if connection is None:
            raise RuntimeError("Roll20 chat bridge is not connected.")

        try:
            await connection.send_json(asdict(message))
        except RuntimeError:
            await self.disconnect(connection)
            await broadcast_bridge_status(connected=await self.is_connected())
            raise RuntimeError("Roll20 chat bridge is not connected.")

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

    def acknowledge_delivery(self, event: Roll20ChatDelivery) -> bool:
        pending = self._pending_deliveries.get(event.message_id)
        if pending is None:
            return False
        _, future = pending
        if future.done():
            return False
        future.set_result(event)
        return True

    async def reset(self) -> None:
        async with self._lock:
            if self._active_connection is not None:
                self._fail_pending_for_connection(self._active_connection)
            self._active_connection = None
            self._pending_deliveries.clear()

    async def is_connected(self) -> bool:
        async with self._lock:
            return self._active_connection is not None

roll20_chat_bridge = Roll20ChatBridge()


async def broadcast_bridge_status(*, connected: bool) -> None:
    from backend.features.session.service import websocket_sessions

    await websocket_sessions.broadcast(
        Roll20BridgeStatusEvent(
            response_id=None,
            connected=connected,
            request_id=None,
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


def handle_bridge_event(event: Roll20BridgeHello | Roll20ChatDelivery) -> None:
    if isinstance(event, Roll20BridgeHello):
        logger.info("Roll20 bridge connected from %s", event.source)
        return

    acknowledged = roll20_chat_bridge.acknowledge_delivery(event)
    if event.success:
        logger.info("Roll20 chat message delivered: %s", event.message_id)
        return

    logger.warning(
        "Roll20 chat message delivery failed for %s (%s)%s",
        event.message_id,
        event.reason or "unknown",
        "" if acknowledged else " without a pending request",
    )
