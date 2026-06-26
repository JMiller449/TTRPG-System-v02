from backend.core.transport import Error
from backend.features.session.models import WebSocketSession
from backend.features.session.service import websocket_sessions
from backend.features.sheet_access import service
from backend.features.sheet_access.schema import (
    ClaimSheetAccessCode,
    GenerateSheetAccessCode,
    GetSheetAccessCodes,
)


async def handle_generate_sheet_access_code(
    session: WebSocketSession,
    request: GenerateSheetAccessCode,
) -> None:
    try:
        response = await service.generate_sheet_access_code(
            sheet_id=request.sheet_id,
            instance_id=request.instance_id,
            request_id=request.request_id,
        )
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


async def handle_get_sheet_access_codes(
    session: WebSocketSession,
    request: GetSheetAccessCodes,
) -> None:
    await websocket_sessions.send(
        session,
        await service.list_sheet_access_codes(request_id=request.request_id),
    )


async def handle_claim_sheet_access_code(
    session: WebSocketSession,
    request: ClaimSheetAccessCode,
) -> None:
    try:
        response = await service.claim_sheet_access_code(
            session,
            code=request.code,
            request_id=request.request_id,
        )
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
