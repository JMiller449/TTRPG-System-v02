from backend.features.auth.schema import AuthenticateResponse, AuthRole


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
