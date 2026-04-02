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

logger = logging.getLogger(__name__)


class Roll20ChatBridge:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket, *, accept: bool = True) -> None:
        if accept:
            await websocket.accept()
        async with self._lock:
            self._connections.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(websocket)

    async def send(self, message: Roll20ChatMessage) -> None:
        async with self._lock:
            connections = tuple(self._connections)
        if not connections:
            raise RuntimeError("Roll20 chat bridge is not connected.")

        delivered = False
        failed_connections: list[WebSocket] = []
        for websocket in connections:
            try:
                await websocket.send_json(asdict(message))
                delivered = True
            except RuntimeError:
                failed_connections.append(websocket)

        for websocket in failed_connections:
            await self.disconnect(websocket)

        if not delivered:
            raise RuntimeError("Roll20 chat bridge is not connected.")

    async def reset(self) -> None:
        async with self._lock:
            self._connections.clear()

    async def is_connected(self) -> bool:
        async with self._lock:
            return bool(self._connections)


roll20_chat_bridge = Roll20ChatBridge()


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
        logger.info(
            "Roll20 bridge connected from %s at %s",
            event.source,
            event.page_url,
        )
        return

    if event.success:
        logger.info("Roll20 chat message delivered: %s", event.message_id)
        return

    logger.warning(
        "Roll20 chat message delivery failed for %s: %s",
        event.message_id,
        event.error or "Unknown error",
    )
