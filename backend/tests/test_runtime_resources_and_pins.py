import asyncio
from copy import deepcopy

import pytest

from backend.features.contribution_points.schema import (
    AdjustContributionPoints,
    SetContributionPoints,
)
from backend.features.contribution_points.service import (
    adjust_contribution_points,
    set_contribution_points,
)
from backend.features.pinned_actions.schema import SetPinnedInstanceActions
from backend.features.pinned_actions.service import (
    set_pinned_instance_actions,
    synchronize_pinned_actions_mutation,
)
from backend.features.sheet_runtime.schema import (
    AdjustInstancedSheetReactions,
    ResetInstancedSheetReactions,
)
from backend.features.sheet_runtime.service import (
    adjust_instanced_sheet_reactions,
    reset_instanced_sheet_reactions,
)
from backend.features.state_sync.service import state_sync_service
from backend.state.migrations import migrate_persisted_state
from backend.state.models.action import Action
from backend.state.models.attribute import AttributeBridge, AttributeValue
from backend.state.models.item import Item, ItemActionGrant, ItemBridge
from backend.state.models.sheet import InstancedSheet, Sheet
from backend.state.models.shared import Bridge
from backend.state.models.state import State
from backend.state.store import StateSingleton


def _sheet() -> Sheet:
    formula = {"aliases": None, "text": "0"}
    return Sheet.from_dict(
        {
            "id": "hero",
            "name": "Hero",
            "dm_only": False,
            "xp_given_when_slayed": 0,
            "xp_cap": 100,
            "proficiencies": {},
            "items": {},
            "stats": {
                "strength": 1,
                "dexterity": 1,
                "constitution": 1,
                "perception": 1,
                "arcane": 1,
                "will": 1,
                **{
                    key: formula
                    for key in (
                        "lifting", "carry_weight", "acrobatics", "stamina", "reaction_time",
                        "health", "endurance", "pain_tolerance", "sight_distance", "intuition",
                        "registration", "mana", "control", "sensitivity", "charisma",
                        "mental_fortitude", "courage",
                    )
                },
            },
            "actions": {},
        }
    )


def _state() -> State:
    sheet = _sheet()
    instance = InstancedSheet.from_dict(
        {"parent_id": "hero", "health": 1, "mana": 1, "augments": {}}, template=sheet
    )
    instance.reactions = 1.0
    instance.attributes["amount_of_reactions"] = AttributeBridge(
        relationship_id="reaction_limit",
        attribute_id="amount_of_reactions",
        value=AttributeValue(type="number", value=1.5),
        evaluated_value=1.5,
    )
    return State(sheets={"hero": sheet}, instanced_sheets={"hero_1": instance})


@pytest.fixture(autouse=True)
def _isolated_state(monkeypatch: pytest.MonkeyPatch):
    original = StateSingleton._state
    monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
    StateSingleton._state = _state()
    try:
        yield
    finally:
        StateSingleton._state = original


def test_fractional_reactions_spend_restore_reset_and_boundaries() -> None:
    async def scenario() -> None:
        await adjust_instanced_sheet_reactions(
            AdjustInstancedSheetReactions(
                type="adjust_instanced_sheet_reactions", instance_id="hero_1", delta=-0.5
            )
        )
        assert StateSingleton.getState().instanced_sheets["hero_1"].reactions == 0.5
        await adjust_instanced_sheet_reactions(
            AdjustInstancedSheetReactions(
                type="adjust_instanced_sheet_reactions", instance_id="hero_1", delta=0.25
            )
        )
        assert StateSingleton.getState().instanced_sheets["hero_1"].reactions == 0.75
        with pytest.raises(ValueError, match="more reactions"):
            await adjust_instanced_sheet_reactions(
                AdjustInstancedSheetReactions(
                    type="adjust_instanced_sheet_reactions", instance_id="hero_1", delta=-1
                )
            )
        await reset_instanced_sheet_reactions(
            ResetInstancedSheetReactions(type="reset_instanced_sheet_reactions", instance_id="hero_1")
        )
        assert StateSingleton.getState().instanced_sheets["hero_1"].reactions == 1.5

    asyncio.run(scenario())


def test_contribution_points_are_atomic_nonnegative_and_audited() -> None:
    async def scenario() -> None:
        await set_contribution_points(
            SetContributionPoints(type="set_contribution_points", instance_id="hero_1", value=5)
        )
        await adjust_contribution_points(
            AdjustContributionPoints(type="adjust_contribution_points", instance_id="hero_1", delta=-2)
        )
        state = StateSingleton.getState()
        assert state.instanced_sheets["hero_1"].contribution_points == 3
        assert [entry.amount for entry in state.contribution_point_transactions.values()] == [5, -2]
        with pytest.raises(ValueError, match="below zero"):
            await adjust_contribution_points(
                AdjustContributionPoints(type="adjust_contribution_points", instance_id="hero_1", delta=-4)
            )
        assert state.instanced_sheets["hero_1"].contribution_points == 3

    asyncio.run(scenario())


def test_pins_are_instance_scoped_and_stale_entries_are_cleaned() -> None:
    async def scenario() -> None:
        state = StateSingleton.getState()
        state.actions["strike"] = Action.from_dict({"id": "strike", "name": "Strike", "steps": []})
        state.instanced_sheets["hero_1"].actions["strike_bridge"] = Bridge(
            relationship_id="strike_bridge", entry_id="strike"
        )
        await set_pinned_instance_actions(
            SetPinnedInstanceActions(
                type="set_pinned_instance_actions",
                instance_id="hero_1",
                action_relationship_ids=["strike_bridge"],
            )
        )
        assert state.instanced_sheets["hero_1"].pinned_action_ids == ["strike_bridge"]
        state.actions.pop("strike")
        operations = synchronize_pinned_actions_mutation(state)
        assert operations
        assert state.instanced_sheets["hero_1"].pinned_action_ids == []
        with pytest.raises(ValueError, match="currently available"):
            await set_pinned_instance_actions(
                SetPinnedInstanceActions(
                    type="set_pinned_instance_actions",
                    instance_id="hero_1",
                    action_relationship_ids=["missing"],
                )
            )

    asyncio.run(scenario())


def test_v31_migration_preserves_existing_instances_with_safe_runtime_defaults() -> None:
    migrated = migrate_persisted_state(
        {
            "schema_version": 31,
            "state": {"instanced_sheets": {"hero_1": {"parent_id": "hero"}}},
        }
    )
    instance = migrated.state["instanced_sheets"]["hero_1"]
    assert instance["reactions"] == 0
    assert instance["contribution_points"] == 0
    assert instance["pinned_action_ids"] == []
    assert migrated.state["contribution_point_transactions"] == {}


def test_player_snapshot_isolates_other_character_runtime_balances() -> None:
    async def scenario() -> None:
        state = StateSingleton.getState()
        other = deepcopy(state.instanced_sheets["hero_1"])
        other.reactions = 1.5
        other.contribution_points = 99
        other.pinned_action_ids = ["secret"]
        state.instanced_sheets["hero_2"] = other
        snapshot = await state_sync_service.snapshot(
            role="player", assigned_instance_id="hero_1"
        )
        own = snapshot.state["instanced_sheets"]["hero_1"]
        hidden = snapshot.state["instanced_sheets"]["hero_2"]
        assert own["contribution_points"] == 0
        assert "contribution_points" not in hidden
        assert "pinned_action_ids" not in hidden
        assert "reactions" not in hidden

    asyncio.run(scenario())
