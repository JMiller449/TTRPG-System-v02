from __future__ import annotations

from backend.core.config import (
    LOCAL_DEV_DM_ADMIN_CODE,
    LOCAL_DEV_PLAYER_JOIN_CODE,
    LOCAL_DEV_SERVICE_AUTH_CODE,
    get_auth_code_config,
)
from backend.features.auth.schema import AuthRole

PLAYER_JOIN_CODE = LOCAL_DEV_PLAYER_JOIN_CODE
DM_ADMIN_CODE = LOCAL_DEV_DM_ADMIN_CODE
SERVICE_AUTH_CODE = LOCAL_DEV_SERVICE_AUTH_CODE


def authenticate_token(token: str) -> AuthRole | None:
    auth_codes = get_auth_code_config()
    if token == auth_codes.dm_admin_code:
        return "dm"
    if token == auth_codes.player_join_code:
        return "player"
    if token == auth_codes.service_auth_code:
        return "service"
    return None


def authenticate_app_token(token: str) -> AuthRole | None:
    role = authenticate_token(token)
    if role in {"player", "dm"}:
        return role
    return None


def is_valid_dm_admin_code(admin_code: str) -> bool:
    return admin_code == get_auth_code_config().dm_admin_code
