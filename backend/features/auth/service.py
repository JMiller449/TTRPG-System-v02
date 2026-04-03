from backend.features.auth import tokens as auth_tokens
from backend.features.auth.schema import Authenticate, AuthenticateResponse, AuthRole
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
    await websocket_sessions.send(
        updated_session,
        build_authenticate_response(
            authenticated=True,
            role=role,
            request_id=request.request_id,
        ),
    )
    return updated_session
