from __future__ import annotations

import asyncio
import json
from copy import deepcopy
from typing import Any

from backend.features.session.models import SessionRole

import pytest

from backend.features.stat_points.service import project
from backend.features.state_sync.service import state_sync_service as sync
from backend.routes.ws import handle_client_payload, websocket_sessions
from backend.state.migrations import build_persisted_state, migrate_persisted_state
from backend.state.models.sheet import InstancedSheet, Sheet
from backend.state.models.state import State
from backend.state.store import DEFAULT_STATE, StateSingleton
from backend.tests.test_sheet_admin_sheets import FakeWebSocket, _sheet_payload


@pytest.fixture
def campaign(monkeypatch: pytest.MonkeyPatch) -> State:
    state = deepcopy(DEFAULT_STATE)
    state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
    monkeypatch.setattr(StateSingleton, "_state", state)
    return state


async def connect(role: SessionRole = "dm", instance_id: str | None = None) -> FakeWebSocket:
    socket = FakeWebSocket()
    await websocket_sessions.connect(socket, role=role)
    if instance_id:
        await websocket_sessions.assign_player_sheet(socket, sheet_id="mage_template", instance_id=instance_id)
    return socket


async def send(socket: FakeWebSocket, request_type: str, **fields: Any) -> None:
    await handle_client_payload(socket, {"type": request_type, **fields})


async def spawn(socket: FakeWebSocket, instance_id: str = "hero") -> None:
    await send(socket, "create_instanced_sheet", instance_id=instance_id, parent_sheet_id="mage_template")


def test_spawn_grants_allocations_exact_undo_and_reload(campaign: State) -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        dm = await connect()
        await spawn(dm)
        summary, entries = project(campaign, "hero")
        starting = sum(summary.allocated.values())
        assert summary.earned["starting"] == starting
        assert not summary.has_legacy_baseline
        assert all(e.actor_role == "dm" for e in entries)
        await send(dm, "set_instanced_sheet_unassigned_stat_points", instance_id="hero", value=3,
                   point_source="level_up", reason="Level 2 award", request_id="grant-level")
        await send(dm, "set_instanced_sheet_unassigned_stat_points", instance_id="hero", value=7,
                   point_source="manual", reason="Quest reward")
        player = await connect("player", "hero")
        await send(player, "allocate_instanced_sheet_stat_points", instance_id="hero",
                   allocations={"strength": 5, "arcane": 1}, request_id="allocation")
        summary, entries = project(campaign, "hero")
        assert summary.unspent == 1
        assert summary.earned["level_up"] == 3
        assert summary.earned["manual"] == 4
        assert summary.allocation_sources["strength"]["level_up"] == 3
        assert summary.allocation_sources["strength"]["manual"] == 2
        assert summary.allocation_sources["arcane"]["manual"] == 1
        assert summary.player_allocations["strength"] == 5
        assert summary.reconciles
        allocations = [e for e in entries if e.kind == "allocation"]
        assert all(e.actor_role == "player" and e.actor_instance_id == "hero" for e in allocations)
        assert sum(e.amount for e in allocations) == 6
        previous_entries = deepcopy(campaign.stat_point_history)
        # A repeated ID must not duplicate either spending or audit entries.
        await send(player, "allocate_instanced_sheet_stat_points", instance_id="hero",
                   allocations={"strength": 5, "arcane": 1}, request_id="allocation")
        assert campaign.stat_point_history == previous_entries
        await send(dm, "undo_last_state_change")
        summary, entries = project(campaign, "hero")
        assert summary.unspent_sources["level_up"] == 3
        assert summary.unspent_sources["manual"] == 4
        assert summary.allocation_sources["strength"]["starting"] == 10
        assert summary.player_allocations["strength"] == 0
        assert summary.reconciles
        assert all(campaign.stat_point_history[key] == value for key, value in previous_entries.items())
        # Undo grant and undo manual removal restore exact original sources.
        await send(dm, "undo_last_state_change")
        summary, _ = project(campaign, "hero")
        assert summary.unspent == 3
        assert summary.removed["manual"] == 4
        await send(dm, "set_instanced_sheet_unassigned_stat_points", instance_id="hero", value=1)
        assert project(campaign, "hero")[0].removed["level_up"] == 2
        await send(dm, "undo_last_state_change")
        assert project(campaign, "hero")[0].unspent_sources["level_up"] == 3
        assert project(campaign, "hero")[0].earned["level_up"] == 3
        assert project(campaign, "hero")[0].removed["level_up"] == 0
        restored = State.from_dict(migrate_persisted_state(json.loads(json.dumps(build_persisted_state(campaign.to_dict(include_private=True)), sort_keys=True))).state)
        assert [e.id for e in project(restored, "hero")[1]] == [e.id for e in project(campaign, "hero")[1]]
        assert restored.stat_point_history == campaign.stat_point_history
        assert project(restored, "hero")[0] == project(campaign, "hero")[0]
    asyncio.run(scenario())


def test_direct_level_award_and_despawn_preserve_history(campaign: State) -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        dm = await connect()
        await spawn(dm)
        await send(dm, "set_instanced_sheet_base_stat", instance_id="hero", stat_name="strength",
                   value=14, point_source="level_up", reason="Level 2: strength +4")
        summary, entries = project(campaign, "hero")
        assert summary.earned["level_up"] == 4
        last = entries[-1]
        assert (last.previous_value, last.resulting_value, last.amount) == (10, 14, 4)
        assert last.skill == "strength" and last.reason == "Level 2: strength +4"
        history = deepcopy(campaign.stat_point_history)
        await send(dm, "delete_instanced_sheet", instance_id="hero")
        assert "hero" not in campaign.instanced_sheets
        assert all(campaign.stat_point_history[k] == v for k, v in history.items())
        await send(dm, "undo_last_state_change")
        assert project(campaign, "hero")[0].reconciles
        assert project(campaign, "hero")[0].allocation_sources["strength"]["level_up"] == 4
        assert project(campaign, "hero")[0].earned == summary.earned
    asyncio.run(scenario())


def test_legacy_migration_marks_unknown_and_detects_untracked_edits(campaign: State) -> None:
    template = campaign.sheets["mage_template"]
    campaign.instanced_sheets["legacy"] = InstancedSheet.from_dict(
        {"parent_id": template.id, "health": 30, "mana": 20, "augments": {}, "unassigned_stat_points": 9}, template=template)
    raw = campaign.to_dict(include_private=True)
    raw.pop("stat_point_history")
    migrated = migrate_persisted_state({"schema_version": 53, "state": raw})
    restored = State.from_dict(migrated.state)
    summary, entries = project(restored, "legacy")
    assert summary.has_legacy_baseline
    assert summary.earned["starting"] == 0
    assert summary.unspent_sources["legacy_unknown"] == 9
    assert all(e.request_type == "baseline" for e in entries)
    again = State.from_dict(restored.to_dict(include_private=True))
    assert again.stat_point_history == restored.stat_point_history
    assert summary.reconciles
    restored.instanced_sheets["legacy"].stats.strength += 1
    assert not project(restored, "legacy")[0].reconciles


def test_snapshot_patch_redaction_authorization_and_failed_requests(campaign: State) -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        dm = await connect()
        await spawn(dm)
        await spawn(dm, "other")
        player = await connect("player", "hero")
        await send(dm, "set_instanced_sheet_unassigned_stat_points", instance_id="hero", value=2, reason="Private DM note")
        summary = (await sync.snapshot(role="player", assigned_instance_id="hero")).state
        assert "stat_point_history" not in summary
        assert "other" not in summary["instanced_sheets"]
        assert "stat_point_audit" not in summary["instanced_sheets"]["hero"]
        assert summary["instanced_sheets"]["hero"]["stat_point_summary"]["unspent"] == 2
        dm_state = (await sync.snapshot(role="dm")).state
        assert dm_state["instanced_sheets"]["hero"]["stat_point_audit"][-1]["reason"] == "Private DM note"
        assert "Private DM note" not in str(player.sent_messages)
        assert "stat_point_audit" not in str(player.sent_messages)
        replay = await sync.replay_since(0, role="player", assigned_instance_id="hero")
        assert "stat_point_audit" not in str(replay)
        assert "Private DM note" not in str(replay)
        before = deepcopy(campaign.to_dict(include_private=True))
        for payload in [
            {"type": "set_instanced_sheet_unassigned_stat_points", "instance_id": "hero", "value": 99},
            {"type": "allocate_instanced_sheet_stat_points", "instance_id": "other", "allocations": {"strength": 1}},
            {"type": "allocate_instanced_sheet_stat_points", "instance_id": "hero", "allocations": {"strength": 3}},
            {"type": "allocate_instanced_sheet_stat_points", "instance_id": "hero", "allocations": {"strength": 1}, "point_source": "starting"},
        ]:
            await handle_client_payload(player, payload)
            assert campaign.to_dict(include_private=True) == before
        await send(dm, "set_instanced_sheet_unassigned_stat_points", instance_id="hero", value=2)
        assert campaign.to_dict(include_private=True) == before
    asyncio.run(scenario())


def test_checkpoint_failure_rolls_back_points_history_and_undo(campaign: State, monkeypatch: pytest.MonkeyPatch) -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        dm = await connect()
        await spawn(dm)
        old = deepcopy(campaign.to_dict(include_private=True))
        version = sync.current_version
        def fail() -> None:
            raise OSError("disk full")
        with monkeypatch.context() as patch:
            patch.setattr(StateSingleton, "dumpState", fail)
            with pytest.raises(OSError):
                await sync.set("/instanced_sheets/hero/unassigned_stat_points", 4)
        assert campaign.to_dict(include_private=True) == old
        assert sync.current_version == version
        await send(dm, "set_instanced_sheet_unassigned_stat_points", instance_id="hero", value=4)
        before_undo = deepcopy(campaign.to_dict(include_private=True))
        with monkeypatch.context() as patch:
            patch.setattr(StateSingleton, "dumpState", fail)
            with pytest.raises(OSError):
                await sync.undo_last_change()
        assert campaign.to_dict(include_private=True) == before_undo
        assert await sync.undo_last_change()
        assert project(campaign, "hero")[0].unspent == 0
    asyncio.run(scenario())


def test_existing_audit_entries_cannot_be_removed_by_runtime_mutations(campaign: State) -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        dm = await connect()
        await spawn(dm)
        before = deepcopy(campaign.to_dict(include_private=True))
        entry_id = next(iter(campaign.stat_point_history))
        with pytest.raises(ValueError, match="append-only"):
            await sync.remove(f"/stat_point_history/{entry_id}")
        assert campaign.to_dict(include_private=True) == before
    asyncio.run(scenario())
