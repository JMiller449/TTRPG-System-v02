from __future__ import annotations

import asyncio
from collections.abc import Iterable
from dataclasses import asdict, is_dataclass
from typing import Any

from fastapi import WebSocket

from backend.features.session.models import SessionRole, WebSocketSession
from backend.core.transport import SocketGroup

VALID_SOCKET_GROUPS: tuple[SocketGroup, ...] = ("dms", "players")


class WebSocketSessionService:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._sessions: dict[WebSocket, WebSocketSession] = {}

    async def connect(
        self,
        websocket: WebSocket,
        *,
        role: SessionRole = "unauthenticated",
        accept: bool = True,
    ) -> WebSocketSession:
        if accept:
            await websocket.accept()
        async with self._lock:
            session = WebSocketSession(websocket=websocket, role=role)
            self._sessions[websocket] = session
        return session

    async def set_role(
        self,
        websocket: WebSocket,
        role: SessionRole,
    ) -> WebSocketSession:
        session = await self.get_session(websocket)
        async with self._lock:
            session.role = role
        return session

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._sessions.pop(websocket, None)

    async def reset(self) -> None:
        async with self._lock:
            self._sessions.clear()

    async def get_session(self, websocket: WebSocket) -> WebSocketSession:
        async with self._lock:
            session = self._sessions.get(websocket)
        if session is None:
            raise ValueError("WebSocket is not connected.")
        return session

    async def is_dm(self, websocket: WebSocket) -> bool:
        return (await self.get_session(websocket)).is_dm

    async def group_counts(self) -> dict[SocketGroup, int]:
        async with self._lock:
            total_connections = sum(
                1 for session in self._sessions.values() if session.is_authenticated
            )
            dm_connections = sum(
                1 for session in self._sessions.values() if session.is_dm
            )
        return {
            "dms": dm_connections,
            "players": total_connections,
        }

    async def send(self, session: WebSocketSession, payload: Any) -> None:
        if is_dataclass(payload):
            await session.websocket.send_json(asdict(payload))
            return
        await session.websocket.send_json(payload)

    async def broadcast(
        self,
        payload: Any,
        *,
        groups: Iterable[SocketGroup] | None = None,
        exclude: Iterable[WebSocket] | None = None,
    ) -> None:
        target_groups = tuple(groups) if groups is not None else VALID_SOCKET_GROUPS
        excluded_connections = set(exclude or [])

        async with self._lock:
            targets: set[WebSocket] = set()
            if "players" in target_groups:
                targets.update(
                    websocket
                    for websocket, session in self._sessions.items()
                    if session.is_authenticated
                )
            if "dms" in target_groups:
                targets.update(
                    websocket
                    for websocket, session in self._sessions.items()
                    if session.is_dm
                )

        disconnected: list[WebSocket] = []
        for websocket in targets:
            if websocket in excluded_connections:
                continue
            try:
                if is_dataclass(payload):
                    await websocket.send_json(asdict(payload))
                else:
                    await websocket.send_json(payload)
            except RuntimeError:
                disconnected.append(websocket)

        for websocket in disconnected:
            await self.disconnect(websocket)


websocket_sessions = WebSocketSessionService()
