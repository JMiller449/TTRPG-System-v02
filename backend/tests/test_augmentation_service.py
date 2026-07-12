import asyncio
from copy import deepcopy
from dataclasses import asdict

import pytest

from backend.features.augmentations import service as augmentation_service
from backend.features.session.service import websocket_sessions
from backend.features.state_sync.service import state_sync_service
from backend.state.models.augmentation import (
    Augmentation,
    AugmentationLifecycle,
    AugmentationSource,
    AugmentationTarget,
    FormulaModifierEffect,
    StandaloneEffectDefinition,
)
from backend.state.models.condition import ConditionPreset, ConditionSource
from backend.state.models.formula import Formula
from backend.state.models.item import Item, ItemBridge
from backend.state.models.sheet import InstancedSheet, Sheet
from backend.state.models.state import State
from backend.state.store import DEFAULT_STATE, StateSingleton


class FakeWebSocket:
    def __init__(self) -> None:
        self.accepted = False
        self.sent_messages: list[dict] = []

    async def accept(self) -> None:
        self.accepted = True

    async def send_json(self, payload: dict) -> None:
        self.sent_messages.append(payload)


def _reset_state() -> None:
    StateSingleton._state = deepcopy(DEFAULT_STATE)


def _build_instance(template: Sheet | None = None) -> InstancedSheet:
    return InstancedSheet.from_dict(
        {
            "parent_id": "sheet-1",
            "health": 10,
            "mana": 5,
            "augments": {},
        },
        template=template or _build_sheet(),
    )


def _formula_payload(text: str = "0") -> dict:
    return {
        "aliases": None,
        "text": text,
    }


def _build_sheet() -> Sheet:
    formula = _formula_payload()
    return Sheet.from_dict(
        {
            "id": "sheet-1",
            "name": "Mage",
            "notes": "",
            "dm_only": False,
            "xp_given_when_slayed": 0,
            "xp_cap": "",
            "proficiencies": {},
            "items": {},
            "stats": {
                "strength": 10,
                "dexterity": 10,
                "constitution": 10,
                "perception": 10,
                "arcane": 10,
                "will": 10,
                "lifting": formula,
                "carry_weight": formula,
                "acrobatics": formula,
                "stamina": formula,
                "reaction_time": formula,
                "health": formula,
                "endurance": formula,
                "pain_tolerance": formula,
                "sight_distance": formula,
                "intuition": formula,
                "registration": formula,
                "mana": formula,
                "control": formula,
                "sensitivity": formula,
                "charisma": formula,
                "mental_fortitude": formula,
                "courage": formula,
            },
            "resistances": {},
            "slayed_record": {},
            "actions": {},
        }
    )


def _build_augmentation(
    *,
    augmentation_id: str = "aug-1",
    active: bool = True,
    applied: bool = False,
    applied_target_id: str | None = None,
    root: str = "instance",
    scope: str = "instance",
    path: list[str] | None = None,
    operation: str = "add",
    value: str = "5",
    lifecycle: AugmentationLifecycle | None = None,
) -> Augmentation:
    return Augmentation(
        id=augmentation_id,
        name="Blessed Health",
        description="Temporary health modifier.",
        source=AugmentationSource(type="manual", label="GM adjustment"),
        scope=scope,
        target=AugmentationTarget(
            root=root,
            path=["health"] if path is None else path,
        ),
        effect=FormulaModifierEffect(
            operation=operation,
            value=Formula(
                aliases=None,
                text=value,
            ),
        ),
        active=active,
        applied=applied,
        applied_target_id=applied_target_id,
        lifecycle=lifecycle or AugmentationLifecycle(),
    )


def _build_equipment_item(
    item_id: str,
    *,
    value: str,
    operation: str = "add",
    target_root: str = "instance",
    target_path: list[str] | None = None,
) -> Item:
    template = _build_augmentation(
        augmentation_id=f"{item_id}-health",
        value=value,
        operation=operation,
        root=target_root,
        scope=target_root,
        path=target_path,
    )
    template.source = AugmentationSource(type="item", id=item_id, label=item_id)
    return Item.from_dict(
        {
            "id": item_id,
            "name": item_id.replace("-", " ").title(),
            "interaction_type": "equippable",
            "category": "Test Gear",
            "rank": "F",
            "description": "",
            "price": "",
            "weight": "",
            "augmentation_templates": [asdict(template)],
        }
    )


def _condition_template_payload(
    *,
    template_id: str = "poison-drain",
    root: str = "instance",
    path: list[str] | None = None,
) -> dict:
    return {
        "id": template_id,
        "name": "Poison Drain",
        "description": "Health penalty while poisoned.",
        "source": {
            "type": "condition",
            "id": "poisoned",
            "label": "Poisoned",
        },
        "scope": "instance",
        "target": {
            "root": root,
            "path": ["health"] if path is None else path,
        },
        "effect": {
            "type": "formula_modifier",
            "operation": "subtract",
            "value": {
                "aliases": None,
                "text": "2",
            },
        },
        "active": True,
        "applied": False,
        "applied_target_id": None,
        "lifecycle": {
            "mode": "manual",
            "remaining": None,
            "expires_at": None,
            "remove_when_source_inactive": False,
            "notes": None,
        },
    }


def _build_condition_preset(
    *,
    condition_id: str = "poisoned",
    template_root: str = "instance",
    with_template: bool = True,
    visibility: str = "public",
) -> ConditionPreset:
    return ConditionPreset.from_dict(
        {
            "id": condition_id,
            "name": "Poisoned",
            "description": "Ongoing poison effect.",
            "visibility": visibility,
            "augmentation_templates": (
                [_condition_template_payload(root=template_root)]
                if with_template
                else []
            ),
        }
    )


def test_apply_condition_preset_creates_links_and_applies_current_instance_only(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.instanced_sheets["inst-1"] = _build_instance()
            state.instanced_sheets["inst-2"] = _build_instance()
            state.instanced_sheets["inst-2"].health = 20
            state.condition_presets["poisoned"] = _build_condition_preset()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            result = await augmentation_service.apply_condition_preset(
                instance_id="inst-1",
                condition_id="poisoned",
                request_id="req-1",
            )

            concrete_id = "condition:poisoned:inst-1:poison-drain"
            assert result.operation == "applied"
            assert [item.operation for item in result.augmentation_results] == [
                "applied"
            ]
            assert state.instanced_sheets["inst-1"].health == 8
            assert state.instanced_sheets["inst-2"].health == 20
            assert concrete_id in state.augmentations
            assert state.augmentations[concrete_id].source.type == "condition"
            assert state.augmentations[concrete_id].source.id == "poisoned"
            assert state.augmentations[concrete_id].source.application_id == (
                "condition:poisoned:inst-1"
            )
            assert state.augmentations[concrete_id].lifecycle_owner == "condition"
            assert state.augmentations[concrete_id].applied_target_id == "inst-1"
            assert state.instanced_sheets["inst-1"].augments[concrete_id].entry_id == (
                concrete_id
            )
            assert concrete_id not in state.instanced_sheets["inst-2"].augments
            application_id = "condition:poisoned:inst-1"
            assert state.active_conditions[application_id].augmentation_ids == [
                concrete_id
            ]
            assert [op["path"] for op in websocket.sent_messages[0]["ops"]] == [
                f"/active_conditions/{application_id}",
                f"/augmentations/{concrete_id}",
                f"/instanced_sheets/inst-1/augments/{concrete_id}",
                "/instanced_sheets/inst-1/health",
                f"/augmentations/{concrete_id}/applied",
                f"/augmentations/{concrete_id}/applied_target_id",
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_remove_condition_preset_reverses_unlinks_and_removes_concrete_augmentation(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.instanced_sheets["inst-1"] = _build_instance()
            state.condition_presets["poisoned"] = _build_condition_preset()
            await augmentation_service.apply_condition_preset(
                instance_id="inst-1",
                condition_id="poisoned",
                request_id="req-1",
            )

            concrete_id = "condition:poisoned:inst-1:poison-drain"

            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            result = await augmentation_service.remove_condition_preset(
                instance_id="inst-1",
                condition_id="poisoned",
                request_id="req-2",
            )

            assert result.operation == "removed"
            assert [item.operation for item in result.augmentation_results] == [
                "removed"
            ]
            assert state.instanced_sheets["inst-1"].health == 10
            assert concrete_id not in state.instanced_sheets["inst-1"].augments
            assert concrete_id not in state.augmentations
            assert state.active_conditions == {}
            assert websocket.sent_messages[0]["ops"][-3:] == [
                {
                    "op": "remove",
                    "path": f"/instanced_sheets/inst-1/augments/{concrete_id}",
                    "value": None,
                },
                {
                    "op": "remove",
                    "path": f"/augmentations/{concrete_id}",
                    "value": None,
                },
                {
                    "op": "remove",
                    "path": "/active_conditions/condition:poisoned:inst-1",
                    "value": None,
                },
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_condition_preset_hook_rejects_missing_preset_or_instance(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.instanced_sheets["inst-1"] = _build_instance()

            with pytest.raises(
                ValueError,
                match="Condition preset 'missing' does not exist.",
            ):
                await augmentation_service.apply_condition_preset(
                    instance_id="inst-1",
                    condition_id="missing",
                    request_id="req-1",
                )

            state.condition_presets["poisoned"] = _build_condition_preset()
            with pytest.raises(
                ValueError,
                match="Instanced sheet 'missing' does not exist.",
            ):
                await augmentation_service.apply_condition_preset(
                    instance_id="missing",
                    condition_id="poisoned",
                    request_id="req-2",
                )
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_condition_application_is_idempotent_and_supports_zero_effect_statuses(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.instanced_sheets["inst-1"] = _build_instance()
            state.condition_presets["marked"] = _build_condition_preset(
                condition_id="marked",
                with_template=False,
            )

            first = await augmentation_service.apply_condition_preset(
                instance_id="inst-1",
                condition_id="marked",
            )
            duplicate = await augmentation_service.apply_condition_preset(
                instance_id="inst-1",
                condition_id="marked",
            )

            assert first.operation == "applied"
            assert first.augmentation_results == []
            assert duplicate.operation == "ignored"
            assert duplicate.reason == "already_applied"
            assert list(state.active_conditions) == ["condition:marked:inst-1"]

            removed = await augmentation_service.remove_condition_application(
                instance_id="inst-1",
                application_id="condition:marked:inst-1",
            )
            assert removed.operation == "removed"
            assert state.active_conditions == {}
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_condition_application_patches_respect_visibility_and_player_assignment(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.instanced_sheets["inst-1"] = _build_instance()
            state.instanced_sheets["inst-2"] = _build_instance()
            state.condition_presets["public"] = _build_condition_preset(
                condition_id="public"
            )
            state.condition_presets["secret"] = _build_condition_preset(
                condition_id="secret",
                visibility="gm_only",
            )
            await websocket_sessions.reset()
            dm = FakeWebSocket()
            player_one = FakeWebSocket()
            player_two = FakeWebSocket()
            await websocket_sessions.connect(dm, role="dm")
            await websocket_sessions.connect(player_one, role="player")
            await websocket_sessions.assign_player_sheet(
                player_one,
                sheet_id="sheet-1",
                instance_id="inst-1",
            )
            await websocket_sessions.connect(player_two, role="player")
            await websocket_sessions.assign_player_sheet(
                player_two,
                sheet_id="sheet-2",
                instance_id="inst-2",
            )

            await augmentation_service.apply_condition_preset(
                instance_id="inst-1",
                condition_id="public",
            )
            await augmentation_service.apply_condition_preset(
                instance_id="inst-1",
                condition_id="secret",
            )

            def condition_paths(message: dict) -> list[str]:
                return [
                    op["path"]
                    for op in message["ops"]
                    if op["path"].startswith("/active_conditions/")
                    or op["path"].startswith("/augmentations/condition:")
                    or "/augments/condition:" in op["path"]
                ]

            assert condition_paths(dm.sent_messages[0])
            assert condition_paths(player_one.sent_messages[0])
            assert condition_paths(player_two.sent_messages[0]) == []
            assert condition_paths(dm.sent_messages[1])
            assert condition_paths(player_one.sent_messages[1]) == []
            assert condition_paths(player_two.sent_messages[1]) == []
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_condition_preset_hook_rejects_non_instance_templates(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.instanced_sheets["inst-1"] = _build_instance()
            state.condition_presets["poisoned"] = _build_condition_preset(
                template_root="sheet"
            )

            with pytest.raises(
                ValueError,
                match="must target the current instance",
            ):
                await augmentation_service.apply_condition_preset(
                    instance_id="inst-1",
                    condition_id="poisoned",
                    request_id="req-1",
                )

            assert state.instanced_sheets["inst-1"].health == 10
            assert state.augmentations == {}
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_equipment_effect_lifecycle_recomputes_from_stable_base(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await state_sync_service.reset()
            await websocket_sessions.reset()
            dm_socket = FakeWebSocket()
            player_socket = FakeWebSocket()
            await websocket_sessions.connect(dm_socket, role="dm")
            await websocket_sessions.connect(player_socket, role="player")
            state = StateSingleton.getState()
            sheet = _build_sheet()
            sheet.items = {
                "helm": ItemBridge(
                    relationship_id="helm",
                    count=1,
                    equipped=False,
                    item_id="flame-helm",
                ),
                "ring": ItemBridge(
                    relationship_id="ring",
                    count=1,
                    equipped=False,
                    item_id="health-ring",
                ),
            }
            state.sheets[sheet.id] = sheet
            state.instanced_sheets["inst-1"] = _build_instance(sheet)
            state.items["flame-helm"] = _build_equipment_item(
                "flame-helm",
                value="5",
            )
            state.items["health-ring"] = _build_equipment_item(
                "health-ring",
                value="2",
            )

            async def set_equipped(relationship_id: str, equipped: bool) -> None:
                def mutation(current_state):
                    path = state_sync_service.join_path(
                        "instanced_sheets",
                        "inst-1",
                        "items",
                        relationship_id,
                        "equipped",
                    )
                    op = state_sync_service.set_mutation(
                        current_state,
                        path,
                        equipped,
                    )
                    return None, [op]

                await state_sync_service.apply_mutation(mutation)

            await set_equipped("helm", True)
            assert state.instanced_sheets["inst-1"].health == 15
            assert len(state.augmentations) == 1
            concrete = next(iter(state.augmentations.values()))
            assert concrete.lifecycle_owner == "equipment"
            assert concrete.source.id == "flame-helm"
            assert concrete.source.relationship_id == "helm"
            assert concrete.source.application_id == "equipment:inst-1:helm"
            assert concrete.id in state.instanced_sheets["inst-1"].augments
            assert all(
                not op["path"].startswith("/direct_effect_projections")
                for socket in (dm_socket, player_socket)
                for op in socket.sent_messages[-1]["ops"]
            )
            assert "direct_effect_projections" not in (
                await state_sync_service.snapshot(role="dm")
            ).state

            await set_equipped("ring", True)
            assert state.instanced_sheets["inst-1"].health == 17

            def damage_mutation(current_state):
                path = state_sync_service.join_path(
                    "instanced_sheets", "inst-1", "health"
                )
                op = state_sync_service.decrement_mutation(current_state, path, 3)
                return None, [op]

            await state_sync_service.apply_mutation(damage_mutation)
            assert state.instanced_sheets["inst-1"].health == 14
            projection = next(iter(state.direct_effect_projections.values()))
            assert projection.base_value == 7
            assert projection.effective_value == 14

            def edit_template_mutation(current_state):
                path = state_sync_service.join_path(
                    "items",
                    "flame-helm",
                    "augmentation_templates",
                    "0",
                    "effect",
                    "value",
                    "text",
                )
                op = state_sync_service.set_mutation(current_state, path, "8")
                return None, [op]

            await state_sync_service.apply_mutation(edit_template_mutation)
            assert state.instanced_sheets["inst-1"].health == 17

            reloaded = type(state).from_dict(state.to_dict(include_private=True))
            StateSingleton._state = reloaded
            assert augmentation_service.synchronize_equipment_augmentations_mutation(
                reloaded
            ) == []
            assert reloaded.instanced_sheets["inst-1"].health == 17

            state = reloaded
            await set_equipped("helm", False)
            assert state.instanced_sheets["inst-1"].health == 9
            await set_equipped("ring", False)
            assert state.instanced_sheets["inst-1"].health == 7
            assert state.direct_effect_projections == {}
            assert state.augmentations == {}
            assert state.instanced_sheets["inst-1"].augments == {}
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_equipment_effect_applies_when_instance_is_created(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await state_sync_service.reset()
            state = StateSingleton.getState()
            sheet = _build_sheet()
            sheet.items["helm"] = ItemBridge(
                relationship_id="helm",
                count=1,
                equipped=True,
                item_id="flame-helm",
            )
            state.sheets[sheet.id] = sheet
            state.items["flame-helm"] = _build_equipment_item(
                "flame-helm",
                value="5",
            )

            def mutation(current_state):
                op = state_sync_service.add_mutation(
                    current_state,
                    state_sync_service.join_path("instanced_sheets", "inst-1"),
                    _build_instance(sheet),
                )
                return None, [op]

            await state_sync_service.apply_mutation(mutation)

            assert state.instanced_sheets["inst-1"].health == 15
            assert len(state.augmentations) == 1
            assert len(state.direct_effect_projections) == 1
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_equipment_stat_effect_is_isolated_to_equipped_instance(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await state_sync_service.reset()
            state = StateSingleton.getState()
            sheet = _build_sheet()
            sheet.items["focus"] = ItemBridge(
                relationship_id="focus",
                count=1,
                equipped=False,
                item_id="focus",
            )
            state.sheets[sheet.id] = sheet
            first = _build_instance(sheet)
            second = _build_instance(sheet)
            first.items["focus"].equipped = True
            state.instanced_sheets["inst-1"] = first
            state.instanced_sheets["inst-2"] = second
            state.items["focus"] = _build_equipment_item(
                "focus",
                value="5",
                target_root="sheet",
                target_path=["stats", "strength"],
            )

            def mutation(current_state):
                op = state_sync_service.set_mutation(
                    current_state,
                    state_sync_service.join_path(
                        "instanced_sheets", "inst-1", "items", "focus", "equipped"
                    ),
                    True,
                )
                return None, [op]

            await state_sync_service.apply_mutation(mutation)

            assert first.stats is not None
            assert second.stats is not None
            assert first.stats.strength == 15
            assert second.stats.strength == 10
            assert sheet.stats.strength == 10
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_failed_equipment_effect_rolls_back_equip_mutation(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await state_sync_service.reset()
            state = StateSingleton.getState()
            sheet = _build_sheet()
            sheet.items["broken"] = ItemBridge(
                relationship_id="broken",
                count=1,
                equipped=False,
                item_id="broken-ring",
            )
            state.sheets[sheet.id] = sheet
            state.instanced_sheets["inst-1"] = _build_instance(sheet)
            state.items["broken-ring"] = _build_equipment_item(
                "broken-ring",
                value="0",
                operation="divide",
            )

            def mutation(current_state):
                op = state_sync_service.set_mutation(
                    current_state,
                    state_sync_service.join_path(
                        "instanced_sheets",
                        "inst-1",
                        "items",
                        "broken",
                        "equipped",
                    ),
                    True,
                )
                return None, [op]

            with pytest.raises(ValueError, match="divide operation cannot use zero"):
                await state_sync_service.apply_mutation(mutation)

            assert state.instanced_sheets["inst-1"].items["broken"].equipped is False
            assert state.instanced_sheets["inst-1"].health == 10
            assert state.augmentations == {}
            assert state.direct_effect_projections == {}
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def _standalone_health_definition(
    definition_id: str,
    *,
    operation: str = "add",
    value: str,
) -> StandaloneEffectDefinition:
    return StandaloneEffectDefinition.from_dict(
        {
            "id": definition_id,
            "name": definition_id.replace("-", " ").title(),
            "description": "Action-controlled direct health effect.",
            "scope": "instance",
            "target": {"root": "instance", "path": ["health"]},
            "effect": {
                "type": "formula_modifier",
                "operation": operation,
                "value": {"aliases": None, "text": value},
                "selector": {},
            },
            "active": True,
            "lifecycle": {
                "mode": "manual",
                "remaining": None,
                "expires_at": None,
                "remove_when_source_inactive": False,
                "notes": None,
            },
        }
    )


def test_equipment_and_standalone_direct_effects_share_path_and_unwind() -> None:
    """A standalone direct effect and an equipment direct effect on the same
    numeric path stack, then each unwinds back to the value contributed by the
    remaining source, and finally to the untouched base."""
    state = deepcopy(DEFAULT_STATE)
    sheet = _build_sheet()
    sheet.items = {
        "helm": ItemBridge(
            relationship_id="helm",
            count=1,
            equipped=True,
            item_id="flame-helm",
        ),
    }
    state.sheets[sheet.id] = sheet
    state.items["flame-helm"] = _build_equipment_item("flame-helm", value="5")
    state.instanced_sheets["inst-1"] = _build_instance(sheet)
    state.standalone_effects["surge"] = _standalone_health_definition(
        "surge", value="3"
    )

    # Equipment projects first: base 10 + helm 5.
    augmentation_service.synchronize_equipment_augmentations_mutation(state)
    assert state.instanced_sheets["inst-1"].health == 15

    # Standalone stacks on the same path: + surge 3.
    augmentation_service.apply_standalone_effect_mutation(
        state, "surge", instance_id="inst-1"
    )
    assert state.instanced_sheets["inst-1"].health == 18
    assert set(state.direct_effect_projections) == {"/instanced_sheets/inst-1/health"}

    # Removing the standalone leaves only the equipment contribution.
    augmentation_service.remove_standalone_effect_mutation(
        state, "surge", instance_id="inst-1"
    )
    assert state.instanced_sheets["inst-1"].health == 15
    assert state.standalone_effect_applications == {}

    # Unequipping restores the untouched base and clears the shared projection.
    state.instanced_sheets["inst-1"].items["helm"].equipped = False
    augmentation_service.synchronize_equipment_augmentations_mutation(state)
    assert state.instanced_sheets["inst-1"].health == 10
    assert state.direct_effect_projections == {}
    assert state.augmentations == {}


def test_apply_condition_preset_records_source_and_timing() -> None:
    state = deepcopy(DEFAULT_STATE)
    state.instanced_sheets["inst-1"] = _build_instance()
    state.condition_presets["poisoned"] = _build_condition_preset()

    result, _ = augmentation_service.apply_condition_preset_mutation(
        state,
        instance_id="inst-1",
        condition_id="poisoned",
        source=ConditionSource(type="action", id="poison", label="Poison"),
        applied_by_role="dm",
        applied_at_state_version=7,
    )

    assert result.operation == "applied"
    active = state.active_conditions["condition:poisoned:inst-1"]
    assert active.source.type == "action"
    assert active.source.id == "poison"
    assert active.source.label == "Poison"
    assert active.applied_by_role == "dm"
    assert active.applied_at_state_version == 7
    assert active.applied_at  # ISO timestamp captured at apply time

    # Metadata survives a serialization round trip.
    reloaded = State.from_dict(deepcopy(state.to_dict(include_private=True)))
    reloaded_active = reloaded.active_conditions["condition:poisoned:inst-1"]
    assert reloaded_active.source.type == "action"
    assert reloaded_active.applied_by_role == "dm"
    assert reloaded_active.applied_at_state_version == 7


def test_apply_condition_preset_defaults_source_when_unspecified() -> None:
    state = deepcopy(DEFAULT_STATE)
    state.instanced_sheets["inst-1"] = _build_instance()
    state.condition_presets["poisoned"] = _build_condition_preset()

    augmentation_service.apply_condition_preset_mutation(
        state, instance_id="inst-1", condition_id="poisoned"
    )

    active = state.active_conditions["condition:poisoned:inst-1"]
    assert active.source.type == "other"
    assert active.applied_by_role is None
    assert active.applied_at_state_version is None


def test_private_state_round_trip_leaves_no_orphaned_effects() -> None:
    """Serializing state with an active condition, a standalone application, and
    an equipment projection, then rebuilding it, preserves effective values and
    leaves the runtime consistent (a re-sync is a no-op, i.e. no orphans).

    This exercises the ``State.to_dict(include_private=True)`` / ``State.from_dict``
    serialization round trip only. It does not exercise the export/import service,
    schema migration, or state-store persistence paths; a dedicated migration/import
    test should accompany the Phase 2 persisted-schema rename."""
    state = deepcopy(DEFAULT_STATE)
    sheet = _build_sheet()
    sheet.items = {
        "helm": ItemBridge(
            relationship_id="helm",
            count=1,
            equipped=True,
            item_id="flame-helm",
        ),
    }
    state.sheets[sheet.id] = sheet
    state.items["flame-helm"] = _build_equipment_item("flame-helm", value="5")
    state.instanced_sheets["inst-1"] = _build_instance(sheet)
    state.standalone_effects["surge"] = _standalone_health_definition(
        "surge", value="3"
    )
    state.condition_presets["poisoned"] = _build_condition_preset()

    # Build a mixed runtime: equipment (+5), standalone (+3), condition (-2).
    augmentation_service.synchronize_equipment_augmentations_mutation(state)
    augmentation_service.apply_standalone_effect_mutation(
        state, "surge", instance_id="inst-1"
    )
    augmentation_service.apply_condition_preset_mutation(
        state, instance_id="inst-1", condition_id="poisoned"
    )
    # Settle projections after the condition's direct mutation so the base is stable.
    augmentation_service.synchronize_projected_direct_effects_mutation(state)

    expected_health = state.instanced_sheets["inst-1"].health
    assert expected_health == 16  # 10 + 5 + 3 - 2

    # Every condition-owned augmentation is anchored to a live active condition.
    condition_application_ids = set(state.active_conditions)
    for augmentation in state.augmentations.values():
        if augmentation.lifecycle_owner == "condition":
            assert augmentation.source.application_id in condition_application_ids

    # Full private round trip, mirroring export -> import serialization.
    reloaded = State.from_dict(deepcopy(state.to_dict(include_private=True)))

    assert reloaded.instanced_sheets["inst-1"].health == expected_health
    assert set(reloaded.augmentations) == set(state.augmentations)
    assert set(reloaded.active_conditions) == set(state.active_conditions)
    assert set(reloaded.standalone_effect_applications) == set(
        state.standalone_effect_applications
    )
    assert set(reloaded.direct_effect_projections) == set(
        state.direct_effect_projections
    )

    # Every runtime application still resolves to live definitions/targets after
    # reload: no dangling references were introduced by serialization.
    for active_condition in reloaded.active_conditions.values():
        for augmentation_id in active_condition.augmentation_ids:
            assert augmentation_id in reloaded.augmentations
    for application in reloaded.standalone_effect_applications.values():
        assert application.definition_id in reloaded.standalone_effects
        assert application.instance_id in reloaded.instanced_sheets

    # Re-synchronizing the rebuilt state changes nothing: no orphaned or
    # double-applied modifiers survived the round trip.
    assert (
        augmentation_service.synchronize_equipment_augmentations_mutation(reloaded)
        == []
    )
    assert reloaded.instanced_sheets["inst-1"].health == expected_health

    # The restored runtime can still fully unwind, not just re-sync: removing every
    # source in turn returns the value to the untouched base.
    augmentation_service.remove_condition_preset_mutation(
        reloaded, instance_id="inst-1", condition_id="poisoned"
    )
    augmentation_service.remove_standalone_effect_mutation(
        reloaded, "surge", instance_id="inst-1"
    )
    reloaded.instanced_sheets["inst-1"].items["helm"].equipped = False
    augmentation_service.synchronize_equipment_augmentations_mutation(reloaded)

    assert reloaded.instanced_sheets["inst-1"].health == 10
    assert reloaded.augmentations == {}
    assert reloaded.active_conditions == {}
    assert reloaded.standalone_effect_applications == {}
    assert reloaded.direct_effect_projections == {}
