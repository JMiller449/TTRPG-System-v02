import pytest

from backend.core.config import load_auth_settings


def test_auth_settings_use_explicit_env_values() -> None:
    config = load_auth_settings(
        {
            "APP_ENV": "production",
            "PLAYER_JOIN_CODE": " custom-player ",
            "DM_ADMIN_CODE": "custom-dm",
            "SERVICE_AUTH_CODE": "custom-service",
        }
    )

    assert config.player_join_code == "custom-player"
    assert config.dm_admin_code == "custom-dm"
    assert config.service_auth_code == "custom-service"


def test_auth_settings_use_local_dev_defaults_for_missing_values() -> None:
    config = load_auth_settings({"APP_ENV": "development"})

    assert config.player_join_code == "player"
    assert config.dm_admin_code == "dm"
    assert config.service_auth_code == "service"


def test_auth_settings_require_explicit_production_values() -> None:
    with pytest.raises(RuntimeError, match="PLAYER_JOIN_CODE must be configured"):
        load_auth_settings({"APP_ENV": "production"})
