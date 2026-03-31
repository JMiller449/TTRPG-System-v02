import json
import logging
from dataclasses import asdict
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from backend.features.auth import service as auth_service, tokens as auth_tokens
from backend.features.auth.schema import Authenticate
from backend.features.chat import service as chat_service
from backend.features.session.service import websocket_sessions
from backend.features.state_sync import handler as state_sync_handler
from backend.core.request_registry import (
    MalformedRequestError,
    UnknownRequestTypeError,
    request_registry,
)

router = APIRouter()
logger = logging.getLogger(__name__)
AUTH_CLOSE_CODE = 1008


def generate_request_id() -> str:
    return str(uuid4())


def _assign_request_id(payload: Any) -> tuple[Any, str | None]:
    if not isinstance(payload, dict):
        return payload, None

    normalized_payload = dict(payload)
    request_id = generate_request_id()
    normalized_payload["request_id"] = request_id
    return normalized_payload, request_id


def _error_payload(reason: str, request_id: str | None = None) -> dict[str, Any]:
    return {
        "response_id": None,
        "reason": reason,
        "type": "error",
        "request_id": request_id,
    }


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


async def handle_client_payload(
    websocket: WebSocket,
    payload: Any,
) -> None:
    normalized_payload, request_id = _assign_request_id(payload)

    try:
        session = await websocket_sessions.get_session(websocket)
        request = await request_registry.dispatch(session, normalized_payload)
    except ValidationError as exc:
        await websocket.send_json(
            _error_payload(
                reason=_validation_error_message(exc),
                request_id=request_id,
            )
        )
        return
    except (MalformedRequestError, UnknownRequestTypeError) as exc:
        await websocket.send_json(
            _error_payload(
                reason=str(exc),
                request_id=request_id,
            )
        )
        return
    except (PermissionError, ValueError) as exc:
        await websocket.send_json(
            _error_payload(
                reason=str(exc),
                request_id=request_id,
            )
        )


async def _receive_json_payload(websocket: WebSocket) -> dict[str, Any]:
    data = await websocket.receive_text()
    try:
        payload = json.loads(data)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid Request: {data}") from exc

    if not isinstance(payload, dict):
        raise ValueError("Invalid Request: payload must be an object")
    return payload


async def _reject_connection(
    websocket: WebSocket,
    *,
    reason: str,
    request_id: str | None = None,
) -> None:
    await websocket.send_json(_error_payload(reason=reason, request_id=request_id))
    await websocket.close(code=AUTH_CLOSE_CODE)


async def authenticate_application_websocket(
    websocket: WebSocket,
    payload: Any,
):
    normalized_payload, request_id = _assign_request_id(payload)

    try:
        request = Authenticate.model_validate(normalized_payload)
    except ValidationError as exc:
        await _reject_connection(
            websocket,
            reason=_validation_error_message(exc),
            request_id=request_id,
        )
        return None

    role = auth_tokens.authenticate_app_token(request.token)
    if role is None:
        await _reject_connection(
            websocket,
            reason="Invalid player or DM code.",
            request_id=request.request_id,
        )
        return None

    session = await websocket_sessions.connect(websocket, role=role, accept=False)
    await websocket_sessions.send(
        session,
        auth_service.build_authenticate_response(
            authenticated=True,
            role=role,
            request_id=request.request_id,
        ),
    )
    return session


async def authenticate_service_websocket(
    websocket: WebSocket,
    payload: Any,
) -> bool:
    normalized_payload, request_id = _assign_request_id(payload)

    try:
        request = Authenticate.model_validate(normalized_payload)
    except ValidationError as exc:
        await _reject_connection(
            websocket,
            reason=_validation_error_message(exc),
            request_id=request_id,
        )
        return False

    role = auth_tokens.authenticate_token(request.token)
    if role != "service":
        await _reject_connection(
            websocket,
            reason="Invalid service code.",
            request_id=request.request_id,
        )
        return False

    await websocket.send_json(
        asdict(
            auth_service.build_authenticate_response(
                authenticated=True,
                role=role,
                request_id=request.request_id,
            )
        )
    )
    return True


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        auth_payload = await _receive_json_payload(websocket)
    except ValueError as exc:
        await _reject_connection(websocket, reason=str(exc))
        return

    session = await authenticate_application_websocket(websocket, auth_payload)
    if session is None:
        return

    await state_sync_handler.send_connection_bootstrap(session)

    try:
        while True:
            try:
                payload = await _receive_json_payload(websocket)
            except ValueError as exc:
                await websocket.send_json(_error_payload(reason=str(exc)))
                continue

            await handle_client_payload(websocket, payload)
    except WebSocketDisconnect:
        pass
    finally:
        await websocket_sessions.disconnect(websocket)


@router.websocket("/ws/chat")
async def chat_bridge_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        auth_payload = await _receive_json_payload(websocket)
    except ValueError as exc:
        await _reject_connection(websocket, reason=str(exc))
        return

    is_authenticated = await authenticate_service_websocket(websocket, auth_payload)
    if not is_authenticated:
        return

    await chat_service.roll20_chat_bridge.connect(websocket, accept=False)

    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
                event = chat_service.parse_bridge_event(payload)
            except json.JSONDecodeError:
                logger.warning("Ignoring non-JSON Roll20 bridge payload: %s", data)
                continue
            except ValidationError as exc:
                logger.warning(
                    "Ignoring invalid Roll20 bridge payload: %s",
                    _validation_error_message(exc),
                )
                continue
            except ValueError as exc:
                logger.warning("Ignoring Roll20 bridge payload: %s", exc)
                continue

            chat_service.handle_bridge_event(event)
    except WebSocketDisconnect:
        pass
    finally:
        await chat_service.roll20_chat_bridge.disconnect(websocket)
