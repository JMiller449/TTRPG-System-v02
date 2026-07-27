import asyncio
from copy import deepcopy

import pytest
from pydantic import ValidationError

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
from backend.features.sheet_runtime.route import (
    AdjustInstancedSheetReactionsRoute,
    ResetInstancedSheetReactionsRoute,
)
from backend.features.session.models import WebSocketSession
from backend.features.state_sync.service import state_sync_service
from backend.state.migrations import migrate_persisted_state
from backend.state.models.action import Action
from backend.state.models.attribute import AttributeBridge, AttributeValue
from backend.state.models.item import Item, ItemActionGrant, ItemBridge
from backend.state.models.sheet import InstancedSheet, Sheet
from backend.state.models.shared import Bridge
from backend.state.models.state import State
from backend.state.store import StateSingleton


def _sheet(*, sheet_id: str = "hero", dm_only: bool = False) -> Sheet:
    formula = {"aliases": None, "text": "0"}
    return Sheet.from_dict(
        {
            "id": sheet_id,
            "name": sheet_id.replace("_", " ").title(),
            "dm_only": dm_only,
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
        value=AttributeValue(type="number", value=2),
        evaluated_value=2,
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


def test_action_reaction_points_consume_restore_reset_and_boundaries() -> None:
    async def scenario() -> None:
        await adjust_instanced_sheet_reactions(
            AdjustInstancedSheetReactions(
                type="adjust_instanced_sheet_reactions", instance_id="hero_1", delta=-1
            )
        )
        assert StateSingleton.getState().instanced_sheets["hero_1"].reactions == 0
        await adjust_instanced_sheet_reactions(
            AdjustInstancedSheetReactions(
                type="adjust_instanced_sheet_reactions", instance_id="hero_1", delta=1
            )
        )
        assert StateSingleton.getState().instanced_sheets["hero_1"].reactions == 1
        await adjust_instanced_sheet_reactions(
            AdjustInstancedSheetReactions(
                type="adjust_instanced_sheet_reactions", instance_id="hero_1", delta=-1
            )
        )
        with pytest.raises(ValueError, match="more action/reaction points"):
            await adjust_instanced_sheet_reactions(
                AdjustInstancedSheetReactions(
                    type="adjust_instanced_sheet_reactions", instance_id="hero_1", delta=-1
                )
            )
        await reset_instanced_sheet_reactions(
            ResetInstancedSheetReactions(type="reset_instanced_sheet_reactions", instance_id="hero_1")
        )
        assert StateSingleton.getState().instanced_sheets["hero_1"].reactions == 2

    asyncio.run(scenario())


def test_action_reaction_adjustment_rejects_fractional_or_multi_point_deltas() -> None:
    for delta in (-2, -0.5, 0, 0.5, 2):
        with pytest.raises(ValidationError):
            AdjustInstancedSheetReactions(
                type="adjust_instanced_sheet_reactions",
                instance_id="hero_1",
                delta=delta,
            )


def test_action_reaction_routes_enforce_player_and_monster_ownership() -> None:
    async def scenario() -> None:
        state = StateSingleton.getState()
        monster_sheet = _sheet(sheet_id="monster", dm_only=True)
        monster = InstancedSheet.from_dict(
            {"parent_id": "monster", "health": 1, "mana": 1, "augments": {}},
            template=monster_sheet,
        )
        monster.reactions = 1
        monster.attributes["amount_of_reactions"] = AttributeBridge(
            relationship_id="monster_reaction_limit",
            attribute_id="amount_of_reactions",
            value=AttributeValue(type="number", value=2),
            evaluated_value=2,
        )
        state.sheets["monster"] = monster_sheet
        state.instanced_sheets["monster_1"] = monster

        player = WebSocketSession(
            websocket=object(),
            role="player",
            assigned_sheet_id="hero",
            assigned_instance_id="hero_1",
        )
        monster_player = WebSocketSession(
            websocket=object(),
            role="player",
            assigned_sheet_id="monster",
            assigned_instance_id="monster_1",
        )
        gm = WebSocketSession(websocket=object(), role="dm")
        adjust_route = AdjustInstancedSheetReactionsRoute()
        reset_route = ResetInstancedSheetReactionsRoute()

        await adjust_route.handle(
            player,
            AdjustInstancedSheetReactions(
                type="adjust_instanced_sheet_reactions",
                instance_id="hero_1",
                delta=-1,
            ),
        )
        assert state.instanced_sheets["hero_1"].reactions == 0

        with pytest.raises(PermissionError, match="assigned player"):
            await adjust_route.handle(
                gm,
                AdjustInstancedSheetReactions(
                    type="adjust_instanced_sheet_reactions",
                    instance_id="hero_1",
                    delta=-1,
                ),
            )
        with pytest.raises(PermissionError, match="assigned player"):
            await reset_route.handle(
                gm,
                ResetInstancedSheetReactions(
                    type="reset_instanced_sheet_reactions",
                    instance_id="hero_1",
                ),
            )
        with pytest.raises(PermissionError, match="Only a GM"):
            await reset_route.handle(
                monster_player,
                ResetInstancedSheetReactions(
                    type="reset_instanced_sheet_reactions",
                    instance_id="monster_1",
                ),
            )

        await adjust_route.handle(
            gm,
            AdjustInstancedSheetReactions(
                type="adjust_instanced_sheet_reactions",
                instance_id="monster_1",
                delta=-1,
            ),
        )
        assert state.instanced_sheets["monster_1"].reactions == 0
        await reset_route.handle(
            gm,
            ResetInstancedSheetReactions(
                type="reset_instanced_sheet_reactions",
                instance_id="monster_1",
            ),
        )
        assert state.instanced_sheets["monster_1"].reactions == 2

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
        assert own["contribution_points"] == 0
        # Other spawned characters are withheld entirely rather than shipped
        # with a handful of private fields subtracted.
        assert set(snapshot.state["instanced_sheets"]) == {"hero_1"}

    asyncio.run(scenario())
