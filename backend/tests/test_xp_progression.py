import asyncio
from copy import deepcopy

import pytest

from backend.features.xp_tracker.progression import tuning_level_cost, xp_goal
from backend.features.xp_tracker.service import build_xp_tracker
from backend.features.state_sync.service import state_sync_service
from backend.state.models.attribute import synchronize_all_sheet_attributes
from backend.state.models.state import State
from backend.state.models.xp_progression import XpProgression
from backend.state.migrations import migrate_persisted_state
from backend.state.store import StateSingleton
from backend.routes.ws import handle_client_payload, websocket_sessions
from backend.tests.test_xp_tracker import _setup_state, _dm, FakeWebSocket


@pytest.fixture
def campaign(monkeypatch):
    original = StateSingleton.getState()
    monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
    _setup_state()
    state = StateSingleton.getState()
    for sheet in [*state.sheets.values(), *state.instanced_sheets.values()]:
        synchronize_all_sheet_attributes(sheet, state.formulas)
    yield state
    StateSingleton._state = original
    asyncio.run(websocket_sessions.reset())
    asyncio.run(state_sync_service.reset())


def set_attribute(state, name, value):
    bridge = state.instanced_sheets["hero_1"].attributes[name]
    bridge.value.value = value
    synchronize_all_sheet_attributes(state.instanced_sheets["hero_1"], state.formulas)


def test_curve_uses_instance_level_growth_and_milestone_boundaries(campaign):
    assert xp_goal(campaign, "hero_1") == 100
    set_attribute(campaign, "level", 2)
    assert xp_goal(campaign, "hero_1") == 350
    set_attribute(campaign, "xp_growth_rate", 0.8)
    assert xp_goal(campaign, "hero_1") == 280
    assert xp_goal(campaign, "hero_2") == 100
    config = XpProgression(growth_exponent=1, milestone_interval=3,
                           milestone_multiplier=2, growth_multiplier_per_milestone=1.5)
    assert [tuning_level_cost(config, step, 1) for step in range(1, 7)] == [100, 400, 520, 800, 2240, 5630]
    set_attribute(campaign, "level", 3)
    set_attribute(campaign, "xp_growth_rate", 1)
    assert xp_goal(campaign, "hero_1", config) == 1020
    no_growth = XpProgression(growth_exponent=1, milestone_interval=3,
                              milestone_multiplier=2, growth_multiplier_per_milestone=1)
    assert tuning_level_cost(no_growth, 3, 1) == 300


def test_formula_and_rounding_apply_growth_after_calculation(campaign):
    set_attribute(campaign, "level", 3)
    set_attribute(campaign, "xp_growth_rate", 1.2)
    config = XpProgression(mode="formula", expression="max(100, @{level} ** 2 * 100 + 9)")
    assert xp_goal(campaign, "hero_1", config) == 1090
    assert xp_goal(campaign, "hero_1", XpProgression(base_xp=101)) == 960
    set_attribute(campaign, "xp_growth_rate", 0.001)
    assert xp_goal(campaign, "hero_1") == 30


@pytest.mark.parametrize("kwargs", [
    {"growth_multiplier_per_milestone": -0.01}, {"growth_multiplier_per_milestone": float("inf")},
    {"base_xp": 0}, {"base_xp": float("nan")}, {"growth_exponent": -1},
    {"milestone_multiplier": 0.5}, {"milestone_interval": 0}, {"rounding": 1.5},
    {"expression": "1d100"}, {"expression": "__import__('os')"},
    {"expression": "@level ** @level"}, {"expression": "(2 ** 16) ** 16"},
])
def test_invalid_settings_rejected(kwargs):
    with pytest.raises(ValueError):
        XpProgression(**kwargs)


def test_missing_attribute_and_overflow_do_not_break_tracker(campaign):
    campaign.xp_progression = XpProgression(mode="formula", expression="@missing + 1")
    tracker = build_xp_tracker(role="player", assigned_instance_id="hero_1", state=campaign)
    assert tracker.progression is None
    assert tracker.sheets[0].goal_error
    assert not tracker.sheets[0].ready_to_level
    campaign.xp_progression = XpProgression(milestone_multiplier=1000)
    set_attribute(campaign, "level", 1000000)
    assert build_xp_tracker(role="dm", state=campaign).sheets[0].goal_error


def test_migration_retires_caps_preserves_awards_and_round_trips(campaign):
    raw = campaign.to_dict(include_private=True)
    raw.pop("xp_progression")
    raw["sheets"]["hero"]["xp_cap"] = 999
    raw["instanced_sheets"]["hero_1"]["attributes"].pop("xp_growth_rate")
    awards = deepcopy(raw["kill_registry"])
    migrated = migrate_persisted_state({"schema_version": 48, "state": raw}).state
    assert migrated["kill_registry"] == awards
    assert "xp_cap" not in migrated["sheets"]["hero"]
    loaded = State.from_dict(migrated)
    assert xp_goal(loaded, "hero_1") == 100
    assert State.from_dict(loaded.to_dict(include_private=True)).xp_progression == loaded.xp_progression


def test_dm_route_live_updates_manual_level_and_undo(campaign):
    async def scenario():
        await websocket_sessions.reset()
        await state_sync_service.reset()
        dm = await _dm()
        unclaimed = FakeWebSocket()
        await websocket_sessions.connect(unclaimed, role="player")
        player = FakeWebSocket()
        session = await websocket_sessions.connect(player, role="player")
        session.assigned_instance_id = "hero_1"
        session.assigned_sheet_id = "hero"
        await handle_client_payload(player, {"type": "get_xp_tracker"})
        await handle_client_payload(player, {"type": "set_xp_progression", "progression": {"base_xp": 200}})
        assert player.sent_messages[-1]["type"] == "error"
        await handle_client_payload(dm, {"type": "set_sheet_xp_required", "sheet_id": "hero", "xp_required": 999})
        assert dm.sent_messages[-1]["type"] == "error"
        await handle_client_payload(dm, {"type": "set_xp_progression", "progression": {"base_xp": 200}})
        tracker = [m for m in player.sent_messages if m["type"] == "xp_tracker"][-1]
        assert tracker["sheets"][0]["xp_required"] == 200
        assert tracker["progression"] is None
        assert all(message["type"] != "xp_tracker" for message in unclaimed.sent_messages)
        assert campaign.instanced_sheets["hero_1"].attributes["level"].evaluated_value == 1
        await state_sync_service.undo_last_change()
        assert campaign.xp_progression.base_xp == 100
        assert player.sent_messages[-1]["sheets"][0]["xp_required"] == 100
        await handle_client_payload(dm, {"type": "set_instanced_sheet_attribute_value", "instance_id": "hero_1", "attribute_id": "level", "value": {"type": "number", "value": 2}})
        assert player.sent_messages[-1]["sheets"][0]["xp_required"] == 350
        before = campaign.xp_progression
        await handle_client_payload(dm, {"type": "set_xp_progression", "progression": {"mode": "formula", "expression": "1 / 0"}})
        assert dm.sent_messages[-1]["type"] == "error"
        assert campaign.xp_progression == before
    asyncio.run(scenario())


def test_awards_never_change_level_and_remaining_is_authoritative(campaign):
    async def scenario():
        await websocket_sessions.reset()
        await state_sync_service.reset()
        dm = await _dm()
        await handle_client_payload(dm, {"type": "record_kill", "kill_id": "kill", "credited_instance_id": "hero_1", "monster_sheet_id": "goblin"})
        tracker = build_xp_tracker(role="dm", state=campaign).sheets[0]
        assert tracker.current_xp == 100
        assert tracker.ready_to_level
        assert tracker.xp_remaining == 0
        assert campaign.instanced_sheets["hero_1"].attributes["level"].evaluated_value == 1
        await handle_client_payload(dm, {"type": "set_instanced_sheet_attribute_value", "instance_id": "hero_1", "attribute_id": "level", "value": {"type": "number", "value": 2}})
        tracker = build_xp_tracker(role="dm", state=campaign).sheets[0]
        assert tracker.current_xp == 100
        assert tracker.xp_remaining == 250
        assert not tracker.ready_to_level
        for value in (0, -1):
            await handle_client_payload(dm, {"type": "set_instanced_sheet_attribute_value", "instance_id": "hero_1", "attribute_id": "xp_growth_rate", "value": {"type": "number", "value": value}})
            assert dm.sent_messages[-1]["type"] == "error"
            assert campaign.instanced_sheets["hero_1"].attributes["xp_growth_rate"].evaluated_value == 1
    asyncio.run(scenario())


def test_corrected_default_costs_around_milestones():
    config = XpProgression(growth_multiplier_per_milestone=1.02)
    assert [tuning_level_cost(config, level, 1) for level in (23, 24, 25, 26, 49, 50)] == [6890, 7880, 8410, 8880, 22950, 24340]


def test_v50_migration_updates_old_defaults_and_preserves_custom_settings():
    old = {"mode": "tuning", "base_xp": 100, "growth_exponent": 2,
           "milestone_interval": 25, "milestone_multiplier": 1,
           "rounding": 10, "expression": "100 * @level ** 2"}
    migrated = migrate_persisted_state({"schema_version": 49, "state": {"xp_progression": old}}).state
    assert migrated["xp_progression"]["growth_exponent"] == 1.35
    assert migrated["xp_progression"]["milestone_multiplier"] == 1.08
    assert migrated["xp_progression"]["growth_multiplier_per_milestone"] == 1
    old["base_xp"] = 200
    migrated = migrate_persisted_state({"schema_version": 49, "state": {"xp_progression": old}}).state
    assert migrated["xp_progression"]["base_xp"] == 200
    assert migrated["xp_progression"]["growth_exponent"] == 2
    assert migrated["xp_progression"]["growth_multiplier_per_milestone"] == 1.02


def test_tuning_uses_compounding_exponent_multipliers_and_lifetime_totals():
    config = XpProgression(growth_multiplier_per_milestone=1.02)
    costs = [tuning_level_cost(config, level, 1) for level in range(1, 34)]
    assert costs == [100, 250, 440, 650, 880, 1120, 1380, 1660, 1940,
                     2240, 2550, 2860, 3190, 3530, 3870, 4220, 4580,
                     4950, 5320, 5710, 6100, 6490, 6890, 7880, 8410,
                     8880, 9350, 9830, 10320, 10810, 11310, 11820, 12330]
    assert sum(costs[:24]) == 78800  # Lifetime XP to reach level 25.
    assert sum(costs[:25]) == 87210  # Lifetime XP to reach level 26.
    assert tuning_level_cost(XpProgression(base_xp=105), 1, 1) == 110


def test_neutral_multipliers_keep_exponent_fixed_across_milestones():
    config = XpProgression(growth_exponent=2, milestone_interval=50,
                           milestone_multiplier=1, growth_multiplier_per_milestone=1)
    assert tuning_level_cost(config, 250, 1) == 6250000


def test_v51_migrates_neutral_legacy_growth_and_preserves_new_values():
    migrated = migrate_persisted_state({"schema_version": 50, "state": {
        "xp_progression": {"growth_increase_per_milestone": 0}
    }}).state["xp_progression"]
    assert migrated["growth_multiplier_per_milestone"] == 1
    assert "growth_increase_per_milestone" not in migrated
    migrated = migrate_persisted_state({"schema_version": 50, "state": {
        "xp_progression": {"growth_multiplier_per_milestone": 1.1}
    }}).state["xp_progression"]
    assert migrated["growth_multiplier_per_milestone"] == 1.1
