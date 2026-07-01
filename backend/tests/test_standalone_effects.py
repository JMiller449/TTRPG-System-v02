import asyncio
from copy import deepcopy

from backend.features.augmentations import service as augmentation_service
from backend.features.formula_runtime.service import FormulaExecutionContext
from backend.features.state_sync.service import state_sync_service
from backend.protocol.socket import normalize_server_event
from backend.routes.ws import handle_client_payload, websocket_sessions
from backend.state.models.action import Action
from backend.state.models.augmentation import StandaloneEffectDefinition
from backend.state.models.sheet import InstancedSheet
from backend.state.models.state import State
from backend.state.store import DEFAULT_STATE, StateSingleton


class FakeWebSocket:
    def __init__(self) -> None:
        self.sent_messages: list[dict] = []

    async def accept(self) -> None:
        return None

    async def send_json(self, payload: dict) -> None:
        self.sent_messages.append(payload)


def _effect_payload(
    effect_id: str = "blessing",
    *,
    effect: dict | None = None,
    active: bool = True,
) -> dict:
    return {
        "id": effect_id,
        "name": "Blessing",
        "description": "Action-controlled health effect.",
        "scope": "instance",
        "target": {"root": "instance", "path": ["health"]},
        "effect": effect
        or {
            "type": "formula_modifier",
            "operation": "add",
            "value": {"aliases": None, "text": "5", "tags": []},
            "selector": {},
        },
        "active": active,
        "lifecycle": {
            "duration": None,
            "expires_at": None,
            "removal_condition": "Removed by its authored action.",
        },
    }


def _definition(effect_id: str = "blessing", **kwargs) -> StandaloneEffectDefinition:
    return StandaloneEffectDefinition.from_dict(_effect_payload(effect_id, **kwargs))


def _instance(health: int) -> InstancedSheet:
    return InstancedSheet.from_dict(
        {
            "parent_id": "sheet-1",
            "health": health,
            "mana": 10,
            "augments": {},
        }
    )


def test_state_round_trips_definitions_and_applications() -> None:
    state = State.from_dict(
        {
            "standalone_effects": {"blessing": _effect_payload()},
            "standalone_effect_applications": {
                "standalone:instance-1:blessing": {
                    "application_id": "standalone:instance-1:blessing",
                    "definition_id": "blessing",
                    "instance_id": "instance-1",
                    "source": {
                        "type": "action",
                        "id": "ward",
                        "label": "Blessing",
                        "relationship_id": "step-1",
                        "application_id": "standalone:instance-1:blessing",
                    },
                    "active": True,
                }
            },
        }
    )

    serialized = state.to_dict()
    assert serialized["standalone_effects"]["blessing"]["id"] == "blessing"
    assert serialized["standalone_effects"]["blessing"]["effect"]["selector"] == {
        "required_tags": [],
        "excluded_tags": [],
        "action_id": None,
        "formula_id": None,
        "step_id": None,
    }
    assert serialized["standalone_effect_applications"][
        "standalone:instance-1:blessing"
    ]["source"]["relationship_id"] == "step-1"


def test_state_snapshot_protocol_accepts_standalone_effect_records() -> None:
    normalized = normalize_server_event(
        {
            "response_id": None,
            "state": {
                "standalone_effects": {"blessing": _effect_payload()},
                "standalone_effect_applications": {},
            },
            "state_version": 1,
            "type": "state_snapshot",
            "request_id": None,
        }
    )

    assert normalized["state"]["standalone_effects"]["blessing"]["scope"] == (
        "instance"
    )


def test_one_definition_applies_independently_and_idempotently_to_two_instances() -> None:
    state = deepcopy(DEFAULT_STATE)
    state.standalone_effects["blessing"] = _definition()
    state.instanced_sheets["instance-1"] = _instance(10)
    state.instanced_sheets["instance-2"] = _instance(20)

    first, _ = augmentation_service.apply_standalone_effect_mutation(
        state,
        "blessing",
        instance_id="instance-1",
        action_id="ward",
        step_id="apply-blessing",
    )
    duplicate, duplicate_ops = augmentation_service.apply_standalone_effect_mutation(
        state,
        "blessing",
        instance_id="instance-1",
        action_id="ward",
        step_id="apply-blessing",
    )
    second, _ = augmentation_service.apply_standalone_effect_mutation(
        state,
        "blessing",
        instance_id="instance-2",
        action_id="ward",
        step_id="apply-blessing",
    )

    assert first.operation == "applied"
    assert duplicate.reason == "already_applied"
    assert duplicate_ops == []
    assert second.operation == "applied"
    assert state.instanced_sheets["instance-1"].health == 15
    assert state.instanced_sheets["instance-2"].health == 25
    assert set(state.standalone_effect_applications) == {
        "standalone:instance-1:blessing",
        "standalone:instance-2:blessing",
    }

    removed, _ = augmentation_service.remove_standalone_effect_mutation(
        state,
        "blessing",
        instance_id="instance-1",
    )

    assert removed.operation == "removed"
    assert state.instanced_sheets["instance-1"].health == 10
    assert state.instanced_sheets["instance-2"].health == 25
    assert set(state.standalone_effect_applications) == {
        "standalone:instance-2:blessing"
    }


def test_set_effect_restores_projection_base_on_removal() -> None:
    state = deepcopy(DEFAULT_STATE)
    state.standalone_effects["set-health"] = _definition(
        "set-health",
        effect={
            "type": "formula_modifier",
            "operation": "set",
            "value": {"aliases": None, "text": "40", "tags": []},
            "selector": {},
        },
    )
    state.instanced_sheets["instance-1"] = _instance(13)

    augmentation_service.apply_standalone_effect_mutation(
        state, "set-health", instance_id="instance-1"
    )
    assert state.instanced_sheets["instance-1"].health == 40

    augmentation_service.remove_standalone_effect_mutation(
        state, "set-health", instance_id="instance-1"
    )
    assert state.instanced_sheets["instance-1"].health == 13


def test_definition_update_recomputes_from_base_and_preserves_external_edits() -> None:
    state = deepcopy(DEFAULT_STATE)
    state.standalone_effects["blessing"] = _definition()
    state.instanced_sheets["instance-1"] = _instance(10)
    augmentation_service.apply_standalone_effect_mutation(
        state, "blessing", instance_id="instance-1"
    )
    assert state.instanced_sheets["instance-1"].health == 15

    state.instanced_sheets["instance-1"].health = 17
    state.standalone_effects["blessing"] = _definition(
        effect={
            "type": "formula_modifier",
            "operation": "add",
            "value": {"aliases": None, "text": "8", "tags": []},
            "selector": {},
        }
    )
    augmentation_service.synchronize_projected_direct_effects_mutation(state)

    assert state.instanced_sheets["instance-1"].health == 20
    augmentation_service.remove_standalone_effect_mutation(
        state, "blessing", instance_id="instance-1"
    )
    assert state.instanced_sheets["instance-1"].health == 12


def test_evaluation_effect_uses_per_instance_application() -> None:
    state = deepcopy(DEFAULT_STATE)
    state.standalone_effects["fire-focus"] = _definition(
        "fire-focus",
        effect={
            "type": "roll_mode_modifier",
            "roll_mode": "advantage",
            "selector": {"required_tags": ["fire", "attack"]},
        },
    )
    state.instanced_sheets["instance-1"] = _instance(10)

    augmentation_service.apply_standalone_effect_mutation(
        state,
        "fire-focus",
        instance_id="instance-1",
        action_id="focus",
        step_id="focus-step",
    )
    matching = augmentation_service.matching_evaluation_effects(
        state,
        sheet_id="sheet-1",
        instance_id="instance-1",
        context=FormulaExecutionContext(tags=("attack", "fire")),
    )
    other_instance = augmentation_service.matching_evaluation_effects(
        state,
        sheet_id="sheet-1",
        instance_id="instance-2",
        context=FormulaExecutionContext(tags=("attack", "fire")),
    )

    assert [effect.roll_mode for effect in matching] == ["advantage"]
    assert other_instance == ()


def test_player_snapshot_only_contains_assigned_instance_applications() -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        try:
            StateSingleton._state = deepcopy(DEFAULT_STATE)
            state = StateSingleton.getState()
            state.standalone_effects["blessing"] = _definition()
            state.instanced_sheets["instance-1"] = _instance(10)
            state.instanced_sheets["instance-2"] = _instance(20)
            augmentation_service.apply_standalone_effect_mutation(
                state, "blessing", instance_id="instance-1"
            )
            augmentation_service.apply_standalone_effect_mutation(
                state, "blessing", instance_id="instance-2"
            )

            snapshot = await state_sync_service.snapshot(
                role="player",
                assigned_instance_id="instance-1",
            )

            assert set(snapshot.state["standalone_effects"]) == {"blessing"}
            assert set(snapshot.state["standalone_effect_applications"]) == {
                "standalone:instance-1:blessing"
            }
            assert "equipment_effect_projections" not in snapshot.state
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_crud_and_player_permission(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            StateSingleton._state = deepcopy(DEFAULT_STATE)
            await websocket_sessions.reset()
            await state_sync_service.reset()
            player = FakeWebSocket()
            await websocket_sessions.connect(player, role="player")
            await handle_client_payload(
                player,
                {"type": "create_standalone_effect", "effect": _effect_payload()},
            )
            assert player.sent_messages[0]["reason"] == (
                "This request requires an authenticated DM session."
            )

            dm = FakeWebSocket()
            await websocket_sessions.connect(dm, role="dm")
            await handle_client_payload(
                dm,
                {
                    "type": "create_standalone_effect",
                    "effect": _effect_payload(),
                    "request_id": "create-effect",
                },
            )
            updated = _effect_payload()
            updated["description"] = "Updated."
            await handle_client_payload(
                dm,
                {
                    "type": "update_standalone_effect",
                    "effect_id": "blessing",
                    "effect": updated,
                    "request_id": "update-effect",
                },
            )
            await handle_client_payload(
                dm,
                {
                    "type": "delete_standalone_effect",
                    "effect_id": "blessing",
                    "request_id": "delete-effect",
                },
            )

            assert StateSingleton.getState().standalone_effects == {}
            assert [message["ops"][0]["op"] for message in dm.sent_messages] == [
                "add",
                "set",
                "remove",
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_delete_rejects_action_references_and_active_applications(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            StateSingleton._state = deepcopy(DEFAULT_STATE)
            state = StateSingleton.getState()
            state.standalone_effects["blessing"] = _definition()
            state.actions["ward"] = Action.from_dict(
                {
                    "id": "ward",
                    "name": "Ward",
                    "steps": [
                        {
                            "step_id": "apply",
                            "type": "apply_augmentation",
                            "augmentation_id": "blessing",
                        }
                    ],
                }
            )
            await websocket_sessions.reset()
            dm = FakeWebSocket()
            await websocket_sessions.connect(dm, role="dm")

            await handle_client_payload(
                dm,
                {"type": "delete_standalone_effect", "effect_id": "blessing"},
            )
            assert dm.sent_messages[0]["reason"] == (
                "Standalone effect 'blessing' is referenced by actions: ward."
            )

            state.actions = {}
            state.instanced_sheets["instance-1"] = _instance(10)
            augmentation_service.apply_standalone_effect_mutation(
                state, "blessing", instance_id="instance-1"
            )
            dm.sent_messages.clear()
            await handle_client_payload(
                dm,
                {"type": "delete_standalone_effect", "effect_id": "blessing"},
            )
            assert dm.sent_messages[0]["reason"] == (
                "Standalone effect 'blessing' has active applications. "
                "Remove them before deleting the definition."
            )
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())
