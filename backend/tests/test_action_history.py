import asyncio
import json
from dataclasses import asdict
from copy import deepcopy

import backend.state.store as store_module
from backend.core.transport import PatchOp
from backend.features.action_history.service import (
    record_action_history_entry,
    serialize_action_history,
    serialize_action_history_entry,
)
from backend.features.state_sync.service import state_sync_service
from backend.features.state_sync.schema import StatePatch
from backend.state.models.action_history import (
    ACTION_HISTORY_RETENTION_LIMIT,
    ActionHistoryEntry,
    ActionHistoryText,
)
from backend.state.models.state import State
from backend.state.store import DEFAULT_STATE, StateSingleton


def _entry(
    *,
    entry_id: str = "history-1",
    created_at: str = "2026-06-18T12:00:00Z",
) -> ActionHistoryEntry:
    return ActionHistoryEntry(
        id=entry_id,
        request_id="request-1",
        action_id="fire_bolt",
        action_name="Fire Bolt",
        actor_role="player",
        actor_sheet_id="mage",
        actor_instance_id="mage-instance",
        target_sheet_id=None,
        created_at=created_at,
        state_version=7,
        status="success",
        public_summary="Fire Bolt succeeded.",
        gm_summary="Fire Bolt resolved Fire damage from @arcane * 2.",
        emitted_messages=[
            ActionHistoryText("Fire Bolt: /r 1d100", visibility="public"),
            ActionHistoryText("GM detail: arcane=14", visibility="gm_only"),
        ],
        mutation_summaries=[
            ActionHistoryText(
                "health=12;damage=8;type=Fire;resistance=20",
                visibility="gm_only",
            )
        ],
        formula_summaries=[
            ActionHistoryText("@arcane * 2 => 28", visibility="gm_only")
        ],
        error=ActionHistoryText("private debug note", visibility="gm_only"),
    )


def _reset_state() -> None:
    StateSingleton._state = deepcopy(DEFAULT_STATE)


def test_dm_action_history_payload_includes_audit_details() -> None:
    payload = serialize_action_history_entry(_entry(), role="dm")

    assert payload is not None
    assert payload.model_dump(mode="json") == {
        "id": "history-1",
        "request_id": "request-1",
        "action_id": "fire_bolt",
        "action_name": "Fire Bolt",
        "actor_role": "player",
        "actor_sheet_id": "mage",
        "actor_instance_id": "mage-instance",
        "target_sheet_id": None,
        "created_at": "2026-06-18T12:00:00Z",
        "state_version": 7,
        "status": "success",
        "summary": "Fire Bolt resolved Fire damage from @arcane * 2.",
        "emitted_messages": [
            "Fire Bolt: /r 1d100",
            "GM detail: arcane=14",
        ],
        "mutation_summaries": [
            "health=12;damage=8;type=Fire;resistance=20",
        ],
        "formula_summaries": ["@arcane * 2 => 28"],
        "error": "private debug note",
        "redacted": False,
    }


def test_player_action_history_payload_is_redacted_to_assigned_instance() -> None:
    payload = serialize_action_history_entry(
        _entry(),
        role="player",
        assigned_instance_id="mage-instance",
    )

    assert payload is not None
    assert payload.summary == "Fire Bolt succeeded."
    assert payload.emitted_messages == ["Fire Bolt: /r 1d100"]
    assert payload.mutation_summaries == []
    assert payload.formula_summaries == []
    assert payload.error is None
    assert payload.redacted is True


def test_player_cannot_view_other_instance_action_history() -> None:
    payload = serialize_action_history_entry(
        _entry(),
        role="player",
        assigned_instance_id="other-instance",
    )

    assert payload is None


def test_action_history_collection_serialization_filters_player_entries() -> None:
    other_entry = _entry()
    other_entry.id = "history-2"
    other_entry.actor_instance_id = "other-instance"

    payloads = serialize_action_history(
        {
            "history-1": _entry(),
            "history-2": other_entry,
        },
        role="player",
        assigned_instance_id="mage-instance",
    )

    assert list(payloads) == ["history-1"]
    assert payloads["history-1"].redacted is True


def test_state_snapshot_redacts_action_history_by_session_assignment() -> None:
    _reset_state()
    StateSingleton._state = State(action_history={"history-1": _entry()})

    async def run() -> tuple[dict, dict]:
        dm_snapshot = await state_sync_service.snapshot(role="dm")
        player_snapshot = await state_sync_service.snapshot(
            role="player",
            assigned_instance_id="mage-instance",
        )
        return dm_snapshot.state, player_snapshot.state

    dm_state, player_state = asyncio.run(run())

    assert dm_state["action_history"]["history-1"]["summary"] == (
        "Fire Bolt resolved Fire damage from @arcane * 2."
    )
    assert dm_state["action_history"]["history-1"]["mutation_summaries"] == [
        "health=12;damage=8;type=Fire;resistance=20",
    ]
    assert player_state["action_history"]["history-1"]["summary"] == (
        "Fire Bolt succeeded."
    )
    assert player_state["action_history"]["history-1"]["mutation_summaries"] == []


def test_live_action_history_patch_serializes_text_for_dm() -> None:
    _reset_state()
    entry = _entry()
    StateSingleton.getState().action_history[entry.id] = entry
    patch = StatePatch(
        response_id=None,
        state_version=8,
        ops=[PatchOp(op="add", path="/action_history/history-1", value=entry)],
    )

    projected = state_sync_service._redact_patch_for_role(patch, role="dm")

    assert projected.ops is not None
    assert projected.ops[0].value["emitted_messages"] == [
        "Fire Bolt: /r 1d100",
        "GM detail: arcane=14",
    ]
    assert projected.ops[0].value["mutation_summaries"] == [
        "health=12;damage=8;type=Fire;resistance=20",
    ]


def test_live_action_history_patch_is_filtered_for_assigned_player() -> None:
    _reset_state()
    entry = _entry()
    StateSingleton.getState().action_history[entry.id] = entry
    patch = StatePatch(
        response_id=None,
        state_version=8,
        ops=[PatchOp(op="add", path="/action_history/history-1", value=entry)],
    )

    projected = state_sync_service._redact_patch_for_role(
        patch,
        role="player",
        assigned_instance_id="mage-instance",
    )

    assert projected.ops is not None
    assert projected.ops[0].value["summary"] == "Fire Bolt succeeded."
    assert projected.ops[0].value["emitted_messages"] == ["Fire Bolt: /r 1d100"]
    assert projected.ops[0].value["mutation_summaries"] == []
    assert projected.ops[0].value["redacted"] is True


def test_record_action_history_entry_trims_to_newest_entries() -> None:
    state = State()

    for index in range(4):
        record_action_history_entry(
            state,
            _entry(
                entry_id=f"history-{index}",
                created_at=f"2026-06-18T12:00:0{index}Z",
            ),
            retention_limit=2,
        )

    assert list(state.action_history) == ["history-2", "history-3"]


def test_state_from_dict_trims_persisted_action_history_to_retention_limit() -> None:
    raw_entries = {
        f"history-{index:03d}": _entry(
            entry_id=f"history-{index:03d}",
            created_at=f"2026-06-18T12:00:{index:03d}Z",
        )
        for index in range(ACTION_HISTORY_RETENTION_LIMIT + 1)
    }
    raw_entries = {key: asdict(entry) for key, entry in raw_entries.items()}

    state = State.from_dict({"action_history": raw_entries})

    assert len(state.action_history) == ACTION_HISTORY_RETENTION_LIMIT
    assert "history-000" not in state.action_history
    assert f"history-{ACTION_HISTORY_RETENTION_LIMIT:03d}" in state.action_history


def test_dump_state_trims_action_history_before_persisting(tmp_path, monkeypatch) -> None:
    state_path = tmp_path / "state.json"
    monkeypatch.setattr(store_module, "STATE_PATH", state_path)
    StateSingleton._state = State(
        action_history={
            f"history-{index:03d}": _entry(
                entry_id=f"history-{index:03d}",
                created_at=f"2026-06-18T12:00:{index:03d}Z",
            )
            for index in range(ACTION_HISTORY_RETENTION_LIMIT + 1)
        }
    )

    StateSingleton.dumpState()

    persisted = json.loads(state_path.read_text(encoding="utf-8"))
    persisted_history = persisted["state"]["action_history"]
    assert len(persisted_history) == ACTION_HISTORY_RETENTION_LIMIT
    assert "history-000" not in persisted_history
    assert f"history-{ACTION_HISTORY_RETENTION_LIMIT:03d}" in persisted_history
