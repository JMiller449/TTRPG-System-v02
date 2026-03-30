import asyncio
import json
from collections.abc import Iterable
from dataclasses import asdict, dataclass
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from backend.schemas.ipc_types.requests import (
    ChatUpdate,
    ElevateToDM,
    Requests,
    SocketGroup,
    parse_request,
)
from backend.schemas.ipc_types.responses import (
    ChatUpdateResponse,
    ElevateToDMResponse,
    Error,
    SocketGroupAssigned,
)

router = APIRouter()
VALID_SOCKET_GROUPS: tuple[SocketGroup, ...] = ("dms", "players")
DEFAULT_CHAT_TARGET: SocketGroup = "players"
DM_ADMIN_CODE = "change-me-dm-code"


def _error_payload(message: str, request_id: str | None = None) -> dict[str, Any]:
    return asdict(
        Error(
            response_id=None,
            message=message,
            request_id=request_id,
        )
    )


def _validation_error_message(exc: ValidationError) -> str:
    errors = exc.errors(include_url=False)
    if not errors:
        return "Invalid request payload"

    formatted_errors: list[str] = []
    for error in errors:
        location = ".".join(str(part) for part in error["loc"])
        if location:
            formatted_errors.append(f"{location}: {error['msg']}")
        else:
            formatted_errors.append(str(error["msg"]))
    return "; ".join(formatted_errors)

@dataclass
class WebSocketSession:
    websocket: WebSocket
    is_dm: bool = False


class WebSocketSessionManager:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._sessions: dict[WebSocket, WebSocketSession] = {}

    async def connect(self, websocket: WebSocket) -> WebSocketSession:
        await websocket.accept()
        async with self._lock:
            session = WebSocketSession(websocket=websocket)
            self._sessions[websocket] = session
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

    async def elevate_to_dm(self, websocket: WebSocket) -> WebSocketSession:
        session = await self.get_session(websocket)
        async with self._lock:
            session.is_dm = True
        return session

    async def is_dm(self, websocket: WebSocket) -> bool:
        return (await self.get_session(websocket)).is_dm

    async def group_counts(self) -> dict[SocketGroup, int]:
        async with self._lock:
            total_connections = len(self._sessions)
            dm_connections = sum(1 for session in self._sessions.values() if session.is_dm)
        return {
            "dms": dm_connections,
            "players": total_connections,
        }

    async def broadcast(
        self,
        payload: dict[str, Any],
        *,
        groups: Iterable[SocketGroup] | None = None,
        exclude: Iterable[WebSocket] | None = None,
    ) -> None:
        target_groups = tuple(groups) if groups is not None else VALID_SOCKET_GROUPS
        excluded_connections = set(exclude or [])

        async with self._lock:
            targets: set[WebSocket] = set()
            if "players" in target_groups:
                targets.update(self._sessions.keys())
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
                await websocket.send_json(payload)
            except RuntimeError:
                disconnected.append(websocket)

        for websocket in disconnected:
            await self.disconnect(websocket)

websocket_sessions = WebSocketSessionManager()


async def broadcast_to_group(group: SocketGroup, payload: dict[str, Any]) -> None:
    await websocket_sessions.broadcast(payload, groups=(group,))


async def broadcast_to_groups(
    groups: Iterable[SocketGroup],
    payload: dict[str, Any],
) -> None:
    await websocket_sessions.broadcast(payload, groups=groups)


async def broadcast_to_all(payload: dict[str, Any]) -> None:
    await websocket_sessions.broadcast(payload)


async def _send_connection_state(
    session: WebSocketSession,
    request_id: str | None = None,
) -> None:
    await session.websocket.send_json(
        asdict(
            SocketGroupAssigned(
                response_id=None,
                is_dm=session.is_dm,
                groups=await websocket_sessions.group_counts(),
                request_id=request_id,
            )
        )
    )


async def _send_elevate_to_dm_response(
    session: WebSocketSession,
    *,
    success: bool,
    request_id: str | None = None,
    reason: str | None = None,
) -> None:
    await session.websocket.send_json(
        asdict(
            ElevateToDMResponse(
                response_id=None,
                success=success,
                is_dm=session.is_dm,
                reason=reason,
                request_id=request_id,
            )
        )
    )


async def handle_client_message(
    session: WebSocketSession,
    request: Requests,
) -> None:
    match request:
        case ElevateToDM():
            if request.admin_code != DM_ADMIN_CODE:
                await _send_elevate_to_dm_response(
                    session,
                    success=False,
                    request_id=request.request_id,
                    reason="Invalid DM admin code.",
                )
                return

            await websocket_sessions.elevate_to_dm(session.websocket)
            await _send_elevate_to_dm_response(
                session,
                success=True,
                request_id=request.request_id,
            )
        case ChatUpdate():
            target_group = request.target_group or DEFAULT_CHAT_TARGET
            await websocket_sessions.broadcast(
                asdict(
                    ChatUpdateResponse(
                        response_id=None,
                        message=request.message,
                        target_group=target_group,
                        request_id=request.request_id,
                    )
                ),
                groups=(target_group,),
            )
        case _:
            await session.websocket.send_json(
                _error_payload(
                    message=f"Unhandled request type: {request.type}",
                    request_id=request.request_id,
                )
            )


async def handle_client_payload(
    websocket: WebSocket,
    payload: Any,
) -> None:
    request_id = payload.get("request_id") if isinstance(payload, dict) else None
    if not isinstance(request_id, str):
        request_id = None

    try:
        request = parse_request(payload)
    except ValidationError as exc:
        await websocket.send_json(
            _error_payload(
                message=_validation_error_message(exc),
                request_id=request_id,
            )
        )
        return

    try:
        session = await websocket_sessions.get_session(websocket)
        await handle_client_message(session, request)
    except ValueError as exc:
        await websocket.send_json(
            _error_payload(
                message=str(exc),
                request_id=request.request_id,
            )
        )


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    session = await websocket_sessions.connect(websocket)
    await _send_connection_state(session)

    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
            except json.JSONDecodeError:
                await websocket.send_json(
                    _error_payload(message=f"Invalid Request: {data}")
                )
                continue

            if not isinstance(payload, dict):
                await websocket.send_json(
                    _error_payload(message="Invalid Request: payload must be an object")
                )
                continue

            await handle_client_payload(websocket, payload)
    except WebSocketDisconnect:
        pass
    finally:
        await websocket_sessions.disconnect(websocket)
