from backend.features.auth import tokens as auth_tokens
from backend.features.auth.schema import Authenticate, AuthenticateResponse, AuthRole
from backend.features.sheet_access import service as sheet_access_service
from backend.features.sheet_access.schema import SheetAccessClaimed
from backend.features.session.models import WebSocketSession
from backend.features.session.service import websocket_sessions


def build_authenticate_response(
    *,
    authenticated: bool,
    role: AuthRole | None,
    request_id: str | None = None,
    reason: str | None = None,
) -> AuthenticateResponse:
    return AuthenticateResponse(
        response_id=None,
        authenticated=authenticated,
        role=role,
        reason=reason,
        request_id=request_id,
    )


async def authenticate_application_session(
    session: WebSocketSession,
    request: Authenticate,
) -> WebSocketSession | None:
    role = auth_tokens.authenticate_app_token(request.token)
    access_code = None
    if role is None:
        access_code = sheet_access_service.resolve_active_sheet_access_code(
            request.token
        )
        if access_code is not None:
            role = "player"
    if role is None:
        await websocket_sessions.send(
            session,
            build_authenticate_response(
                authenticated=False,
                role=None,
                reason="Invalid player or DM code.",
                request_id=request.request_id,
            ),
        )
        return None

    updated_session = await websocket_sessions.set_role(session.websocket, role)
    if access_code is not None:
        assert access_code.instance_id is not None
        updated_session = await websocket_sessions.assign_player_sheet(
            session.websocket,
            sheet_id=access_code.sheet_id,
            instance_id=access_code.instance_id,
        )
    await websocket_sessions.send(
        updated_session,
        build_authenticate_response(
            authenticated=True,
            role=role,
            request_id=request.request_id,
        ),
    )
    if access_code is not None:
        await websocket_sessions.send(
            updated_session,
            SheetAccessClaimed(
                response_id=None,
                sheet_id=access_code.sheet_id,
                instance_id=access_code.instance_id,
                request_id=request.request_id,
            ),
        )
    return updated_session
