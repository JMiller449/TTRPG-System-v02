import json
import os
from collections.abc import Iterator
from pathlib import Path

import pytest

from backend.state import store as store_module
from backend.state.migrations import (
    PersistedStateError,
    build_persisted_state,
    migrate_persisted_state,
)
from backend.state.models.access_code import SheetAccessCode
from backend.state.models.state import State
from backend.state.store import CURRENT_STATE_SCHEMA_VERSION, StateSingleton


@pytest.fixture(autouse=True)
def isolate_state(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[Path]:
    original_state = StateSingleton._state
    state_path = tmp_path / "state.json"
    monkeypatch.setattr(store_module, "STATE_PATH", state_path)
    StateSingleton._state = State()
    try:
        yield state_path
    finally:
        StateSingleton._state = original_state


def _state_payload(*, action_name: str) -> dict:
    state = State.from_dict(
        {
            "actions": {
                action_name: {
                    "id": action_name,
                    "name": action_name.replace("_", " ").title(),
                    "steps": [],
                }
            }
        }
    )
    return state.to_dict(include_private=True)


def _checkpoint(payload: dict, *, schema_version: int = 1) -> dict:
    return {
        "schema_version": schema_version,
        "saved_at": "2026-06-27T12:00:00+00:00",
        "state": payload,
    }


def test_dump_writes_versioned_checkpoint_and_round_trips_state(isolate_state) -> None:
    state_path = isolate_state
    StateSingleton._state = State.from_dict(_state_payload(action_name="attack"))

    StateSingleton.dumpState()

    document = json.loads(state_path.read_text(encoding="utf-8"))
    assert document["schema_version"] == CURRENT_STATE_SCHEMA_VERSION
    assert document["saved_at"].endswith("+00:00")
    assert document["state"]["actions"]["attack"]["name"] == "Attack"

    StateSingleton._state = None
    loaded = StateSingleton.initializeState()
    assert loaded.actions["attack"].name == "Attack"


def test_initialize_migrates_legacy_unversioned_state(isolate_state) -> None:
    state_path = isolate_state
    state_path.write_text(
        json.dumps(_state_payload(action_name="legacy_action")),
        encoding="utf-8",
    )
    StateSingleton._state = None

    loaded = StateSingleton.initializeState()

    assert loaded.actions["legacy_action"].name == "Legacy Action"


def test_v1_item_migration_preserves_text_and_replaces_active_equipment() -> None:
    migrated = migrate_persisted_state(
        {
            "schema_version": 1,
            "state": {
                "items": {
                    "sword": {
                        "id": "sword",
                        "name": "Sword",
                        "description": "Type: Longsword\nRank: B\nImmediate Effects: +2 fire damage",
                        "gm_notes": "Existing note",
                        "price": "10g",
                        "weight": "3",
                        "augmentation_templates": [],
                        "action_grants": [],
                    },
                    "potion": {
                        "id": "potion",
                        "name": "Potion",
                        "description": "Type: Consumable\nRank: F",
                        "price": "1g",
                        "weight": "1",
                        "augmentation_templates": [],
                        "action_grants": [
                            {
                                "action_id": "drink",
                                "availability": "carried",
                                "consume_quantity": 1,
                            }
                        ],
                    },
                },
                "sheets": {
                    "hero": {
                        "items": {
                            "sword_bridge": {
                                "relationship_id": "sword_bridge",
                                "item_id": "sword",
                                "count": 1,
                                "active": True,
                            }
                        }
                    }
                },
            },
        }
    )

    sword = migrated.state["items"]["sword"]
    potion = migrated.state["items"]["potion"]
    bridge = migrated.state["sheets"]["hero"]["items"]["sword_bridge"]
    assert sword["interaction_type"] == "equippable"
    assert sword["category"] == "Longsword"
    assert sword["rank"] == "B"
    assert sword["description"] == "Immediate Effects: +2 fire damage"
    assert "Existing note" in sword["gm_notes"]
    assert "Review the interaction type" in sword["gm_notes"]
    assert potion["interaction_type"] == "consumable"
    assert bridge["equipped"] is True
    assert "active" not in bridge


def test_initialize_recovers_from_backup_when_primary_is_corrupt(
    isolate_state: Path,
) -> None:
    state_path = isolate_state
    backup_path = store_module._backup_path(state_path)
    state_path.write_text('{"schema_version": 1, "state":', encoding="utf-8")
    backup_path.write_text(
        json.dumps(_checkpoint(_state_payload(action_name="recovered_action"))),
        encoding="utf-8",
    )
    StateSingleton._state = None

    loaded = StateSingleton.initializeState()

    assert loaded.actions["recovered_action"].name == "Recovered Action"


def test_initialize_recovers_when_primary_has_invalid_state_shape(
    isolate_state: Path,
) -> None:
    state_path = isolate_state
    backup_path = store_module._backup_path(state_path)
    state_path.write_text(
        json.dumps(_checkpoint({"actions": []})),
        encoding="utf-8",
    )
    backup_path.write_text(
        json.dumps(_checkpoint(_state_payload(action_name="valid_backup"))),
        encoding="utf-8",
    )
    StateSingleton._state = None

    loaded = StateSingleton.initializeState()

    assert loaded.actions["valid_backup"].name == "Valid Backup"


def test_dump_rotates_only_valid_primary_checkpoint_to_backup(
    isolate_state: Path,
) -> None:
    state_path = isolate_state
    backup_path = store_module._backup_path(state_path)

    StateSingleton._state = State.from_dict(_state_payload(action_name="first"))
    StateSingleton.dumpState()
    StateSingleton._state = State.from_dict(_state_payload(action_name="second"))
    StateSingleton.dumpState()

    primary = json.loads(state_path.read_text(encoding="utf-8"))
    backup = json.loads(backup_path.read_text(encoding="utf-8"))
    assert set(primary["state"]["actions"]) == {"second"}
    assert set(backup["state"]["actions"]) == {"first"}

    state_path.write_text("not-json", encoding="utf-8")
    StateSingleton._state = State.from_dict(_state_payload(action_name="third"))
    StateSingleton.dumpState()

    backup = json.loads(backup_path.read_text(encoding="utf-8"))
    assert set(backup["state"]["actions"]) == {"first"}


def test_failed_primary_replace_leaves_recoverable_backup(
    isolate_state: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    state_path = isolate_state
    StateSingleton._state = State.from_dict(_state_payload(action_name="stable"))
    StateSingleton.dumpState()
    StateSingleton._state = State.from_dict(_state_payload(action_name="new"))

    real_replace = os.replace
    replace_count = 0

    def fail_second_replace(source: Path, destination: Path) -> None:
        nonlocal replace_count
        replace_count += 1
        if replace_count == 2:
            raise OSError("simulated interrupted checkpoint replacement")
        real_replace(source, destination)

    monkeypatch.setattr(store_module.os, "replace", fail_second_replace)

    with pytest.raises(OSError, match="simulated interrupted"):
        StateSingleton.dumpState()

    StateSingleton._state = None
    loaded = StateSingleton.initializeState()
    assert loaded.actions["stable"].name == "Stable"


def test_newer_primary_schema_falls_back_to_supported_backup(
    isolate_state: Path,
) -> None:
    state_path = isolate_state
    backup_path = store_module._backup_path(state_path)
    state_path.write_text(
        json.dumps(
            _checkpoint(
                _state_payload(action_name="future"),
                schema_version=CURRENT_STATE_SCHEMA_VERSION + 1,
            )
        ),
        encoding="utf-8",
    )
    backup_path.write_text(
        json.dumps(_checkpoint(_state_payload(action_name="supported"))),
        encoding="utf-8",
    )
    StateSingleton._state = None

    loaded = StateSingleton.initializeState()

    assert set(loaded.actions) == {"supported"}


def test_backup_migration_accepts_legacy_and_current_envelopes() -> None:
    legacy = migrate_persisted_state({"sheets": {}, "items": {}})
    current = migrate_persisted_state(build_persisted_state({"actions": {}}))

    assert legacy.source_version == 0
    assert legacy.migrated is True
    assert legacy.state == {
        "sheets": {},
        "items": {},
        "equipment_effect_projections": {},
    }
    assert current.source_version == CURRENT_STATE_SCHEMA_VERSION
    assert current.migrated is False
    assert current.state == {"actions": {}}


def test_backup_migration_rejects_invalid_and_future_envelopes() -> None:
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


def test_export_and_replace_state_preserve_private_data(isolate_state: Path) -> None:
    state_path = isolate_state
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
    assert not store_module._temporary_path(state_path).exists()
