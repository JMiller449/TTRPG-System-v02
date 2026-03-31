from __future__ import annotations

import os

from backend.features.auth.schema import AuthRole

PLAYER_JOIN_CODE = os.getenv("PLAYER_JOIN_CODE", "change-me-player-code")
DM_ADMIN_CODE = os.getenv("DM_ADMIN_CODE", "change-me-dm-code")
SERVICE_AUTH_CODE = os.getenv("SERVICE_AUTH_CODE", "change-me-service-code")


def authenticate_token(token: str) -> AuthRole | None:
    if token == DM_ADMIN_CODE:
        return "dm"
    if token == PLAYER_JOIN_CODE:
        return "player"
    if token == SERVICE_AUTH_CODE:
        return "service"
    return None


def authenticate_app_token(token: str) -> AuthRole | None:
    role = authenticate_token(token)
    if role in {"player", "dm"}:
        return role
    return None


def is_valid_dm_admin_code(admin_code: str) -> bool:
    return admin_code == DM_ADMIN_CODE
