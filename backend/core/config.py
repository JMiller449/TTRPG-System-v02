from __future__ import annotations

from dataclasses import dataclass
from os import environ
from typing import Mapping


PLAYER_JOIN_CODE_ENV = "PLAYER_JOIN_CODE"
DM_ADMIN_CODE_ENV = "DM_ADMIN_CODE"
SERVICE_AUTH_CODE_ENV = "SERVICE_AUTH_CODE"

LOCAL_DEV_PLAYER_JOIN_CODE = "player"
LOCAL_DEV_DM_ADMIN_CODE = "dm"
LOCAL_DEV_SERVICE_AUTH_CODE = "service"


@dataclass(frozen=True)
class AuthCodeConfig:
    player_join_code: str
    dm_admin_code: str
    service_auth_code: str


def _read_code(env: Mapping[str, str], name: str, default: str) -> str:
    value = env.get(name)
    if value is None or not value.strip():
        return default
    return value.strip()


def get_auth_code_config(env: Mapping[str, str] = environ) -> AuthCodeConfig:
    return AuthCodeConfig(
        player_join_code=_read_code(
            env,
            PLAYER_JOIN_CODE_ENV,
            LOCAL_DEV_PLAYER_JOIN_CODE,
        ),
        dm_admin_code=_read_code(
            env,
            DM_ADMIN_CODE_ENV,
            LOCAL_DEV_DM_ADMIN_CODE,
        ),
        service_auth_code=_read_code(
            env,
            SERVICE_AUTH_CODE_ENV,
            LOCAL_DEV_SERVICE_AUTH_CODE,
        ),
    )
