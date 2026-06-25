from backend.core.config import get_auth_code_config
from backend.features.auth import tokens


def test_auth_code_config_uses_explicit_env_values() -> None:
    config = get_auth_code_config(
        {
            "PLAYER_JOIN_CODE": " custom-player ",
            "DM_ADMIN_CODE": "custom-dm",
            "SERVICE_AUTH_CODE": "custom-service",
        }
    )

    assert config.player_join_code == "custom-player"
    assert config.dm_admin_code == "custom-dm"
    assert config.service_auth_code == "custom-service"


def test_auth_code_config_uses_local_dev_defaults_for_missing_values() -> None:
    config = get_auth_code_config({})

    assert config.player_join_code == "player"
    assert config.dm_admin_code == "dm"
    assert config.service_auth_code == "service"


def test_auth_token_resolution_reads_current_environment(monkeypatch) -> None:
    monkeypatch.setenv("PLAYER_JOIN_CODE", "env-player")
    monkeypatch.setenv("DM_ADMIN_CODE", "env-dm")
    monkeypatch.setenv("SERVICE_AUTH_CODE", "env-service")

    assert tokens.authenticate_token("env-player") == "player"
    assert tokens.authenticate_token("env-dm") == "dm"
    assert tokens.authenticate_token("env-service") == "service"
    assert tokens.authenticate_app_token("env-service") is None
    assert tokens.is_valid_dm_admin_code("env-dm") is True
