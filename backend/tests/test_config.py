import pytest

from backend.core.config import load_auth_settings


def test_auth_settings_use_explicit_values() -> None:
    settings = load_auth_settings(
        {
            "APP_ENV": "production",
            "PLAYER_JOIN_CODE": "player-secret",
            "DM_ADMIN_CODE": "dm-secret",
            "SERVICE_AUTH_CODE": "service-secret",
        }
    )

    assert settings.player_join_code == "player-secret"
    assert settings.dm_admin_code == "dm-secret"
    assert settings.service_auth_code == "service-secret"
    assert settings.environment == "production"


def test_auth_settings_allow_documented_development_defaults() -> None:
    settings = load_auth_settings({"APP_ENV": "development"})

    assert settings.player_join_code == "player"
    assert settings.dm_admin_code == "dm"
    assert settings.service_auth_code == "service"


def test_auth_settings_require_codes_outside_development() -> None:
    with pytest.raises(RuntimeError, match="PLAYER_JOIN_CODE must be configured"):
        load_auth_settings({"APP_ENV": "production"})


def test_auth_settings_reject_empty_or_duplicate_codes() -> None:
    with pytest.raises(RuntimeError, match="DM_ADMIN_CODE must be configured"):
        load_auth_settings(
            {
                "APP_ENV": "production",
                "PLAYER_JOIN_CODE": "player-secret",
                "DM_ADMIN_CODE": " ",
                "SERVICE_AUTH_CODE": "service-secret",
            }
        )

    with pytest.raises(RuntimeError, match="must be distinct"):
        load_auth_settings(
            {
                "APP_ENV": "production",
                "PLAYER_JOIN_CODE": "same-secret",
                "DM_ADMIN_CODE": "same-secret",
                "SERVICE_AUTH_CODE": "service-secret",
            }
        )
