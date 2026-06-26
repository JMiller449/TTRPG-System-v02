from __future__ import annotations

import json

import pytest

from backend.state import store as store_module
from backend.state.migrations import (
    CURRENT_STATE_SCHEMA_VERSION,
    PersistedStateError,
    build_persisted_state,
    migrate_persisted_state,
)
from backend.state.models.access_code import SheetAccessCode
from backend.state.store import StateSingleton


def test_legacy_unversioned_state_migrates_to_current_envelope() -> None:
    result = migrate_persisted_state(
        {
            "sheets": {},
            "items": {},
        }
    )

    assert result.source_version == 0
    assert result.migrated is True
    assert result.state == {
        "sheets": {},
        "items": {},
    }


def test_current_persisted_state_does_not_require_migration() -> None:
    raw = build_persisted_state({"actions": {}})
    result = migrate_persisted_state(raw)

    assert result.source_version == CURRENT_STATE_SCHEMA_VERSION
    assert result.migrated is False
    assert result.state == {"actions": {}}


def test_persisted_state_rejects_invalid_and_future_envelopes() -> None:
    with pytest.raises(PersistedStateError, match="must be a JSON object"):
        migrate_persisted_state([])

    with pytest.raises(PersistedStateError, match="schema_version must be an integer"):
        migrate_persisted_state({"schema_version": "1", "state": {}})

    with pytest.raises(PersistedStateError, match="newer than supported"):
        migrate_persisted_state(
            {
                "schema_version": CURRENT_STATE_SCHEMA_VERSION + 1,
                "state": {},
            }
        )


def test_initialize_state_rewrites_legacy_state_with_current_version(
    tmp_path,
    monkeypatch,
) -> None:
    state_path = tmp_path / "state.json"
    state_path.write_text(json.dumps({"sheets": {}, "items": {}}), encoding="utf-8")
    monkeypatch.setattr(store_module, "STATE_PATH", state_path)
    StateSingleton._state = None

    state = StateSingleton.initializeState()

    assert state.sheets == {}
    persisted = json.loads(state_path.read_text(encoding="utf-8"))
    assert persisted["schema_version"] == CURRENT_STATE_SCHEMA_VERSION
    assert persisted["state"]["sheets"] == {}
    assert not state_path.with_suffix(".json.tmp").exists()


def test_initialize_state_rejects_invalid_json(tmp_path, monkeypatch) -> None:
    state_path = tmp_path / "state.json"
    state_path.write_text("{not-json", encoding="utf-8")
    monkeypatch.setattr(store_module, "STATE_PATH", state_path)
    StateSingleton._state = None

    with pytest.raises(PersistedStateError, match="not valid JSON"):
        StateSingleton.initializeState()


def test_export_and_replace_persisted_state_use_private_envelope(
    tmp_path,
    monkeypatch,
) -> None:
    state_path = tmp_path / "state.json"
    monkeypatch.setattr(store_module, "STATE_PATH", state_path)
    StateSingleton._state = None

    state = StateSingleton.getState()
    state.sheet_access_codes["ACCESS-1"] = SheetAccessCode(
        code="ACCESS-1",
        sheet_id="sheet_1",
        instance_id="instance_1",
    )

    exported = StateSingleton.exportPersistedState()

    assert exported["schema_version"] == CURRENT_STATE_SCHEMA_VERSION
    assert exported["state"]["sheet_access_codes"]["ACCESS-1"] == {
        "active": True,
        "code": "ACCESS-1",
        "instance_id": "instance_1",
        "sheet_id": "sheet_1",
    }

    replacement = StateSingleton.getState()
    replacement.sheet_access_codes = {}
    StateSingleton.replaceState(replacement)

    persisted = json.loads(state_path.read_text(encoding="utf-8"))
    assert persisted["schema_version"] == CURRENT_STATE_SCHEMA_VERSION
    assert persisted["state"]["sheet_access_codes"] == {}
    assert not state_path.with_suffix(".json.tmp").exists()
