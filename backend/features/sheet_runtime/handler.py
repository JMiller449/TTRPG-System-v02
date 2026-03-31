from backend.core.transport import Error
from backend.features.session.models import WebSocketSession
from backend.features.session.service import websocket_sessions
from backend.features.sheet_runtime import service
from backend.features.sheet_runtime.schema import FocusSheet, PerformAction, RollBasicCheck


async def handle_focus_sheet_request(session: WebSocketSession, request: FocusSheet) -> None:
    try:
        response = await service.focus_sheet(session, request)
    except ValueError as exc:
        await websocket_sessions.send(
            session,
            Error(
                response_id=None,
                reason=str(exc),
                request_id=request.request_id,
            ),
        )
        return

    await websocket_sessions.send(session, response)


async def handle_roll_basic_check_request(
    session: WebSocketSession,
    request: RollBasicCheck,
) -> None:
    try:
        response = await service.roll_basic_check(session, request)
    except ValueError as exc:
        await websocket_sessions.send(
            session,
            Error(
                response_id=None,
                reason=str(exc),
                request_id=request.request_id,
            ),
        )
        return

    await websocket_sessions.send(session, response)


async def handle_request(session: WebSocketSession, request: PerformAction) -> None:
    try:
        response = await service.perform_action(session, request)
    except ValueError as exc:
        await websocket_sessions.send(
            session,
            Error(
                response_id=None,
                reason=str(exc),
                request_id=request.request_id,
            ),
        )
        return

    await websocket_sessions.send(session, response)
