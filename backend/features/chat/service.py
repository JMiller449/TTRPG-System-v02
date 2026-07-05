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


class Roll20ChatBridge:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._active_connection: WebSocket | None = None

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
        return previous if previous is not websocket else None

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            if self._active_connection is websocket:
                self._active_connection = None

    async def send(self, message: Roll20ChatMessage) -> None:
        async with self._lock:
            connection = self._active_connection
        if connection is None:
            raise RuntimeError("Roll20 chat bridge is not connected.")

        try:
            await connection.send_json(asdict(message))
        except RuntimeError:
            await self.disconnect(connection)
            await broadcast_bridge_status(connected=await self.is_connected())
            raise RuntimeError("Roll20 chat bridge is not connected.")

    async def reset(self) -> None:
        async with self._lock:
            self._active_connection = None

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

    if event.success:
        logger.info("Roll20 chat message delivered: %s", event.message_id)
        return

    logger.warning(
        "Roll20 chat message delivery failed for %s (%s)",
        event.message_id,
        event.reason or "unknown",
    )
