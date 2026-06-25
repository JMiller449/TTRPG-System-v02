from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass


@dataclass(frozen=True)
class AuthSettings:
    player_join_code: str
    dm_admin_code: str
    service_auth_code: str
    environment: str


_DEVELOPMENT_DEFAULTS = {
    "PLAYER_JOIN_CODE": "player",
    "DM_ADMIN_CODE": "dm",
    "SERVICE_AUTH_CODE": "service",
}


def load_auth_settings(environment: Mapping[str, str] | None = None) -> AuthSettings:
    source = os.environ if environment is None else environment
    app_environment = source.get("APP_ENV", "development").strip().lower()
    allow_development_defaults = app_environment in {"development", "test"}

    codes: dict[str, str] = {}
    for name, development_default in _DEVELOPMENT_DEFAULTS.items():
        value = source.get(name)
        if value is None and allow_development_defaults:
            value = development_default
        if value is None or not value.strip():
            raise RuntimeError(
                f"{name} must be configured when APP_ENV is {app_environment!r}."
            )
        codes[name] = value.strip()

    if len(set(codes.values())) != len(codes):
        raise RuntimeError("Player, DM, and service authentication codes must be distinct.")

    return AuthSettings(
        player_join_code=codes["PLAYER_JOIN_CODE"],
        dm_admin_code=codes["DM_ADMIN_CODE"],
        service_auth_code=codes["SERVICE_AUTH_CODE"],
        environment=app_environment,
    )


AUTH_SETTINGS = load_auth_settings()
