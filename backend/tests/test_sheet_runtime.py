import asyncio
from copy import deepcopy
from dataclasses import asdict

from backend.features.chat import service as chat_service
from backend.features.sheet_runtime.service import (
    _apply_roll_mode_to_message,
    _format_roll20_inline_roll_message,
)
from backend.features.state_sync.service import state_sync_service
from backend.routes.ws import handle_client_payload, websocket_sessions
from backend.state.models.augmentation import Augmentation, StandaloneEffectDefinition
from backend.state.models.action import Action
from backend.state.models.condition import ConditionPreset
from backend.state.models.formula import FormulaDefinition
from backend.state.models.fact import synchronize_required_sheet_facts
from backend.state.models.item import Item, ItemBridge
from backend.state.models.proficiency import Proficiency, ProficiencyBridge
from backend.state.models.sheet import InstancedSheet, Sheet
from backend.state.models.shared import Bridge
from backend.state.store import DEFAULT_STATE, StateSingleton


class FakeWebSocket:
    def __init__(self) -> None:
        self.accepted = False
        self.sent_messages: list[dict] = []

    async def accept(self) -> None:
        self.accepted = True

    async def send_json(self, payload: dict) -> None:
        self.sent_messages.append(payload)

    async def receive_text(self) -> str:
        raise RuntimeError("receive_text not implemented for FakeWebSocket")


def _reset_state() -> None:
    StateSingleton._state = deepcopy(DEFAULT_STATE)


async def _connect_assigned_player(
    websocket: FakeWebSocket,
    *,
    sheet_id: str = "mage_template",
    instance_id: str = "mage_instance",
) -> None:
    await websocket_sessions.connect(websocket, role="player")
    await websocket_sessions.assign_player_sheet(
        websocket,
        sheet_id=sheet_id,
        instance_id=instance_id,
    )


def _formula_payload(
    text: str,
    aliases: list[dict] | None = None,
    tags: list[str] | None = None,
) -> dict:
    payload = {
        "aliases": aliases,
        "text": text,
    }
    if tags is not None:
        payload["tags"] = tags
    return payload


def test_roll_mode_transforms_only_standalone_d100_check_expressions() -> None:
    assert _apply_roll_mode_to_message(
        "Attack: /r (1d100 / 100) * 20",
        "advantage",
    ) == ("[Advantage] Attack: /r (2d100kh1 / 100) * 20", True)
    assert _apply_roll_mode_to_message(
        "Dodge: /r (1D100 / 100) * 15",
        "disadvantage",
    ) == ("[Disadvantage] Dodge: /r (2d100kl1 / 100) * 15", True)
    assert _apply_roll_mode_to_message("Damage: /r 2d8 + 4", "advantage") == (
        "Damage: /r 2d8 + 4",
        False,
    )
    assert _apply_roll_mode_to_message("Damage: /r 2d8 + 4", "critical") == (
        "[Critical] Damage: /r (2 * (2d8 + 4))",
        True,
    )
    assert _apply_roll_mode_to_message("Roll 11d100", "advantage") == (
        "Roll 11d100",
        False,
    )


def test_roll20_command_output_formats_inline_rolls_with_command_names() -> None:
    assert _format_roll20_inline_roll_message(
        "Block: /r floor((20) * (1d100 / 100))"
    ) == "Block: [[floor((20) * (1d100 / 100))]]"
    assert _format_roll20_inline_roll_message(
        "[Advantage] Block: /r ((2d100kh1 / 100) * 10) + (2)"
    ) == "Advantage Block: [[((2d100kh1 / 100) * 10) + (2)]]"
    assert _format_roll20_inline_roll_message(
        "/roll (1d100 / 100) * 20"
    ) == "[[(1d100 / 100) * 20]]"
    assert _format_roll20_inline_roll_message("Mana is (30)") == "Mana is (30)"


def _build_sheet_state() -> Sheet:
    sheet = Sheet.from_dict(
        {
            "id": "mage_template",
            "name": "Mage Template",
            "dm_only": False,
            "xp_given_when_slayed": 25,
            "xp_cap": "A",
            "proficiencies": {},
            "items": {},
            "stats": {
                "strength": 10,
                "dexterity": 11,
                "constitution": 12,
                "perception": 13,
                "arcane": 14,
                "will": 15,
                "lifting": _formula_payload(
                    "@strength * 2",
                    [{"name": "strength", "path": ["stats", "strength"]}],
                ),
                "carry_weight": _formula_payload(
                    "@strength * 3",
                    [{"name": "strength", "path": ["stats", "strength"]}],
                ),
                "acrobatics": _formula_payload(
                    "@dexterity",
                    [{"name": "dexterity", "path": ["stats", "dexterity"]}],
                ),
                "stamina": _formula_payload(
                    "@constitution",
                    [{"name": "constitution", "path": ["stats", "constitution"]}],
                ),
                "reaction_time": _formula_payload(
                    "@dexterity",
                    [{"name": "dexterity", "path": ["stats", "dexterity"]}],
                ),
                "health": _formula_payload(
                    "@constitution * 10",
                    [{"name": "constitution", "path": ["stats", "constitution"]}],
                ),
                "endurance": _formula_payload(
                    "@constitution * 2",
                    [{"name": "constitution", "path": ["stats", "constitution"]}],
                ),
                "pain_tolerance": _formula_payload(
                    "@will", [{"name": "will", "path": ["stats", "will"]}]
                ),
                "sight_distance": _formula_payload(
                    "@perception * 4",
                    [{"name": "perception", "path": ["stats", "perception"]}],
                ),
                "intuition": _formula_payload(
                    "@perception",
                    [{"name": "perception", "path": ["stats", "perception"]}],
                ),
                "registration": _formula_payload(
                    "@arcane", [{"name": "arcane", "path": ["stats", "arcane"]}]
                ),
                "mana": _formula_payload(
                    "@arcane * 8", [{"name": "arcane", "path": ["stats", "arcane"]}]
                ),
                "control": _formula_payload(
                    "@arcane", [{"name": "arcane", "path": ["stats", "arcane"]}]
                ),
                "sensitivity": _formula_payload(
                    "@arcane", [{"name": "arcane", "path": ["stats", "arcane"]}]
                ),
                "charisma": _formula_payload(
                    "@will", [{"name": "will", "path": ["stats", "will"]}]
                ),
                "mental_fortitude": _formula_payload(
                    "@will * 2", [{"name": "will", "path": ["stats", "will"]}]
                ),
                "courage": _formula_payload(
                    "@will", [{"name": "will", "path": ["stats", "will"]}]
                ),
            },
            "slayed_record": {},
            "actions": {
                "primary": {
                    "relationship_id": "bridge-1",
                    "entry_id": "battle_cry",
                }
            },
        }
    )
    synchronize_required_sheet_facts(sheet)
    return sheet


def _build_instance_state() -> InstancedSheet:
    return InstancedSheet.from_dict(
        {
            "parent_id": "mage_template",
            "health": 90,
            "mana": 30,
            "augments": {},
        }
    )


def test_player_can_apply_typed_damage_with_resistance_and_final_floor(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.sheets["mage_template"].resistances.resistance = 0.1
            state.sheets["mage_template"].resistances.magical = 0.1
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.instanced_sheets["mage_instance"].resistances.fire = 0.05
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)

            await handle_client_payload(
                websocket,
                {
                    "type": "apply_instanced_sheet_damage",
                    "instance_id": "mage_instance",
                    "amount": 11.9,
                    "damage_type": "Fire",
                },
            )

            assert state.instanced_sheets["mage_instance"].health == 82
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "set",
                            "path": "/instanced_sheets/mage_instance/health",
                            "value": 82,
                        }
                    ],
                    "state_version": 1,
                    "type": "state_patch",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_apply_typed_damage_to_any_instance(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "apply_instanced_sheet_damage",
                    "instance_id": "mage_instance",
                    "amount": 200,
                    "damage_type": "Slashing",
                },
            )

            assert state.instanced_sheets["mage_instance"].health == 0
            assert websocket.sent_messages[0]["ops"] == [
                {
                    "op": "set",
                    "path": "/instanced_sheets/mage_instance/health",
                    "value": 0,
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def _build_augmentation_state(
    augmentation_id: str = "shielded",
    *,
    operation: str = "add",
    value: str = "5",
    path: list[str] | None = None,
) -> Augmentation:
    return Augmentation.from_dict(
        {
            "id": augmentation_id,
            "name": "Shielded",
            "description": "Temporary action-applied effect.",
            "source": {"type": "action", "id": "ward", "label": "Ward"},
            "scope": "instance",
            "target": {"root": "instance", "path": path or ["health"]},
            "effect": {
                "type": "formula_modifier",
                "operation": operation,
                "value": _formula_payload(value),
            },
            "active": True,
            "applied": False,
            "applied_target_id": None,
            "lifecycle": {
                "duration": None,
                "expires_at": None,
                "removal_condition": None,
            },
        }
    )


def _build_standalone_effect_state(
    effect_id: str = "shielded",
    *,
    operation: str = "add",
    value: str = "5",
    path: list[str] | None = None,
) -> StandaloneEffectDefinition:
    augmentation = _build_augmentation_state(
        effect_id,
        operation=operation,
        value=value,
        path=path,
    )
    return StandaloneEffectDefinition(
        id=augmentation.id,
        name=augmentation.name,
        description=augmentation.description,
        scope=augmentation.scope,
        target=augmentation.target,
        effect=augmentation.effect,
        active=augmentation.active,
        lifecycle=augmentation.lifecycle,
    )


def _build_condition_preset_state(condition_id: str = "poisoned") -> ConditionPreset:
    payload = _build_augmentation_state(
        augmentation_id="poison-drain",
        operation="subtract",
        value="5",
    )
    payload.source.type = "condition"
    return ConditionPreset.from_dict(
        {
            "id": condition_id,
            "name": "Poisoned",
            "description": "Poison drains current health.",
            "visibility": "public",
            "augmentation_ids": [],
            "augmentation_templates": [asdict(payload)],
        }
    )


def _evaluation_augmentation_payload(
    *,
    augmentation_id: str,
    effect: dict,
    source_type: str = "item",
    source_id: str = "item-1",
    active: bool = True,
    applied: bool = False,
    applied_target_id: str | None = None,
) -> dict:
    return {
        "id": augmentation_id,
        "name": augmentation_id,
        "description": "Evaluation-time test effect.",
        "source": {
            "type": source_type,
            "id": source_id,
            "label": source_id,
        },
        "scope": "instance",
        "target": {"root": "instance", "path": ["health"]},
        "effect": effect,
        "active": active,
        "applied": applied,
        "applied_target_id": applied_target_id,
        "lifecycle_owner": "condition" if source_type == "condition" else "equipment",
        "lifecycle": {
            "duration": None,
            "expires_at": None,
            "removal_condition": None,
        },
    }


def test_perform_action_executes_steps_and_returns_snapshot(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            StateSingleton.getState().sheets["mage_template"] = _build_sheet_state()
            StateSingleton.getState().actions["battle_cry"] = Action.from_dict(
                {
                    "id": "battle_cry",
                    "name": "Battle Cry",
                    "notes": "Lower strength, then announce it.",
                    "steps": [
                        {
                            "step_id": "step-1",
                            "type": "set_value",
                            "target": "caster",
                            "path": ["stats", "strength"],
                            "value": _formula_payload(
                                "@strength - 2",
                                [{"name": "strength", "path": ["stats", "strength"]}],
                            ),
                        },
                        {
                            "step_id": "step-2",
                            "type": "send_message",
                            "message": _formula_payload(
                                "Strength now @strength",
                                [{"name": "strength", "path": ["stats", "strength"]}],
                            ),
                        },
                    ],
                }
            )
            await websocket_sessions.reset()
            await chat_service.roll20_chat_bridge.reset()
            websocket = FakeWebSocket()
            bridge_socket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")
            await chat_service.roll20_chat_bridge.connect(bridge_socket)

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_template",
                    "action_id": "battle_cry",
                    "request_id": "req-4",
                },
            )

            assert StateSingleton.getState().sheets["mage_template"].stats.strength == 8
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "set",
                            "path": "/sheets/mage_template/stats/strength",
                            "value": 8,
                        }
                    ],
                    "state_version": 1,
                    "type": "state_patch",
                    "request_id": "req-4",
                },
            ]
            assert bridge_socket.sent_messages == [
                {
                    "message_id": bridge_socket.sent_messages[0]["message_id"],
                    "message": "Strength now (8)",
                    "type": "chat_message",
                    "request_id": "req-4",
                }
            ]
            audit_entry = (await state_sync_service.recent_mutations())[-1]
            assert audit_entry.request_id == "req-4"
            assert audit_entry.source is not None
            assert audit_entry.source.request_type == "perform_action"
            assert audit_entry.source.actor_role == "dm"
            assert audit_entry.source.entity_id("action_id") == "battle_cry"
            assert audit_entry.source.entity_id("sheet_id") == "mage_template"
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_perform_action_resolves_current_global_formula_by_id(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.formulas["battle_message"] = FormulaDefinition.from_dict(
                {
                    "id": "battle_message",
                    "formula": _formula_payload(
                        "Arcane is @arcane",
                        [{"name": "arcane", "path": ["stats", "arcane"]}],
                    ),
                }
            )
            state.formulas["healing_amount"] = FormulaDefinition.from_dict(
                {
                    "id": "healing_amount",
                    "formula": _formula_payload("5"),
                }
            )
            state.actions["battle_cry"] = Action.from_dict(
                {
                    "id": "battle_cry",
                    "name": "Battle Cry",
                    "steps": [
                        {
                            "step_id": "healing",
                            "type": "increment_value",
                            "target": "caster",
                            "path": ["health"],
                            "amount": {
                                "type": "formula_reference",
                                "formula_id": "healing_amount",
                            },
                        },
                        {
                            "step_id": "message",
                            "type": "send_message",
                            "message": {
                                "type": "formula_reference",
                                "formula_id": "battle_message",
                            },
                        }
                    ],
                }
            )
            await websocket_sessions.reset()
            await chat_service.roll20_chat_bridge.reset()
            websocket = FakeWebSocket()
            bridge_socket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")
            await chat_service.roll20_chat_bridge.connect(bridge_socket)

            request = {
                "type": "perform_action",
                "sheet_id": "mage_instance",
                "action_id": "battle_cry",
            }
            await handle_client_payload(websocket, request)
            state.formulas["healing_amount"] = FormulaDefinition.from_dict(
                {
                    "id": "healing_amount",
                    "formula": _formula_payload("7"),
                }
            )
            state.formulas["battle_message"] = FormulaDefinition.from_dict(
                {
                    "id": "battle_message",
                    "formula": _formula_payload("Updated arcane is @arcane", [
                        {"name": "arcane", "path": ["stats", "arcane"]}
                    ]),
                }
            )
            await handle_client_payload(websocket, request)

            assert [message["message"] for message in bridge_socket.sent_messages] == [
                "Arcane is (14)",
                "Updated arcane is (14)",
            ]
            assert state.instanced_sheets["mage_instance"].health == 102
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_perform_action_reuses_calculated_value_once_and_isolates_executions(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        rolls = iter([5, 2])
        monkeypatch.setattr(
            "backend.features.formula_runtime.service.random.randint",
            lambda _minimum, _maximum: next(rolls),
        )
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.actions["drink_potion"] = Action.from_dict(
                {
                    "id": "drink_potion",
                    "name": "Drink Potion",
                    "steps": [
                        {
                            "step_id": "calculate-healing",
                            "type": "calculate_value",
                            "variable_id": "healing_amount",
                            "value": _formula_payload("1d8 + 2", tags=["healing"]),
                        },
                        {
                            "step_id": "apply-healing",
                            "type": "increment_value",
                            "target": "caster",
                            "path": ["health"],
                            "amount": {
                                "type": "calculated_value",
                                "variable_id": "healing_amount",
                            },
                        },
                        {
                            "step_id": "announce-healing",
                            "type": "send_message",
                            "message": _formula_payload(
                                "Restored @healing HP. Health is now @health.",
                                [
                                    {
                                        "name": "healing",
                                        "path": [
                                            "action_values",
                                            "healing_amount",
                                        ],
                                    },
                                    {"name": "health", "path": ["health"]},
                                ],
                            ),
                        },
                    ],
                }
            )
            state.augmentations["healing-bonus"] = Augmentation.from_dict(
                _evaluation_augmentation_payload(
                    augmentation_id="healing-bonus",
                    effect={
                        "type": "evaluation_formula_modifier",
                        "operation": "add",
                        "value": _formula_payload("3"),
                        "selector": {
                            "required_tags": ["healing"],
                            "action_id": "drink_potion",
                            "step_id": "calculate-healing",
                        },
                    },
                    source_type="condition",
                    source_id="blessed",
                    applied=True,
                    applied_target_id="mage_instance",
                )
            )
            await websocket_sessions.reset()
            await chat_service.roll20_chat_bridge.reset()
            websocket = FakeWebSocket()
            bridge_socket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")
            await chat_service.roll20_chat_bridge.connect(bridge_socket)

            request = {
                "type": "perform_action",
                "sheet_id": "mage_instance",
                "action_id": "drink_potion",
            }
            await handle_client_payload(websocket, request)
            await handle_client_payload(websocket, request)

            assert state.instanced_sheets["mage_instance"].health == 107
            assert [message["message"] for message in bridge_socket.sent_messages] == [
                "Restored (10) HP. Health is now (100).",
                "Restored (7) HP. Health is now (107).",
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_perform_action_sends_roll20_inline_roll_with_command_name(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.sheets["mage_template"].stats.strength = 20
            state.actions["block"] = Action.from_dict(
                {
                    "id": "block",
                    "name": "Block",
                    "roll_mode_kind": "check",
                    "steps": [
                        {
                            "step_id": "roll",
                            "type": "send_message",
                            "message": _formula_payload(
                                "Block: /r floor(@strength * (1d100 / 100))",
                                [
                                    {
                                        "name": "strength",
                                        "path": ["stats", "strength"],
                                    }
                                ],
                            ),
                        }
                    ],
                }
            )
            await websocket_sessions.reset()
            await chat_service.roll20_chat_bridge.reset()
            websocket = FakeWebSocket()
            bridge_socket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")
            await chat_service.roll20_chat_bridge.connect(bridge_socket)

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_template",
                    "action_id": "block",
                },
            )

            expected_message = "Block: [[floor((20) * (1d100 / 100))]]"
            assert websocket.sent_messages[0]["type"] == "action_executed"
            assert websocket.sent_messages[0]["emitted_messages"] == [
                expected_message
            ]
            assert bridge_socket.sent_messages == [
                {
                    "message_id": bridge_socket.sent_messages[0]["message_id"],
                    "message": expected_message,
                    "type": "chat_message",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_perform_action_applies_advantage_to_roll20_d100_output(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            StateSingleton.getState().sheets["mage_template"] = _build_sheet_state()
            StateSingleton.getState().actions["arcane_check"] = Action.from_dict(
                {
                    "id": "arcane_check",
                    "name": "Arcane Check",
                    "roll_mode_kind": "check",
                    "steps": [
                        {
                            "step_id": "roll",
                            "type": "send_message",
                            "message": _formula_payload(
                                "Arcane Check: /r (1d100 / 100) * @arcane",
                                [
                                    {
                                        "name": "arcane",
                                        "path": ["stats", "arcane"],
                                    }
                                ],
                            ),
                        }
                    ],
                }
            )
            await websocket_sessions.reset()
            await chat_service.roll20_chat_bridge.reset()
            websocket = FakeWebSocket()
            bridge_socket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")
            await chat_service.roll20_chat_bridge.connect(bridge_socket)

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_template",
                    "action_id": "arcane_check",
                    "roll_mode": "advantage",
                },
            )

            expected_message = "Advantage Arcane Check: [[(2d100kh1 / 100) * (14)]]"
            assert websocket.sent_messages[0]["type"] == "action_executed"
            assert websocket.sent_messages[0]["emitted_messages"] == [
                expected_message
            ]
            assert bridge_socket.sent_messages[0]["message"] == expected_message
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_perform_damage_action_doubles_composed_roll20_expression_in_critical_mode(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.actions["fire_damage_roll"] = Action.from_dict(
                {
                    "id": "fire_damage_roll",
                    "name": "Fire Damage",
                    "roll_mode_kind": "damage",
                    "steps": [
                        {
                            "step_id": "damage-roll",
                            "type": "send_message",
                            "message": _formula_payload(
                                "Fire Damage: /r 2d8 + @arcane",
                                [{"name": "arcane", "path": ["stats", "arcane"]}],
                                tags=["damage", "fire"],
                            ),
                        }
                    ],
                }
            )
            state.augmentations["fire-damage-bonus"] = Augmentation.from_dict(
                _evaluation_augmentation_payload(
                    augmentation_id="fire-damage-bonus",
                    effect={
                        "type": "evaluation_formula_modifier",
                        "operation": "add",
                        "value": _formula_payload("3"),
                        "selector": {
                            "required_tags": ["damage", "fire"],
                            "action_id": "fire_damage_roll",
                            "step_id": "damage-roll",
                        },
                    },
                    source_type="condition",
                    source_id="empowered",
                    applied=True,
                    applied_target_id="mage_instance",
                )
            )
            await websocket_sessions.reset()
            await chat_service.roll20_chat_bridge.reset()
            websocket = FakeWebSocket()
            bridge_socket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")
            await chat_service.roll20_chat_bridge.connect(bridge_socket)

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_instance",
                    "action_id": "fire_damage_roll",
                    "roll_mode": "critical",
                },
            )

            expected = "Critical Fire Damage: [[(2 * ((2d8 + (14)) + (3)))]]"
            assert websocket.sent_messages[0]["emitted_messages"] == [expected]
            assert bridge_socket.sent_messages[0]["message"] == expected
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_perform_action_rejects_modes_outside_authored_mode_kind(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.actions["damage_roll"] = Action.from_dict(
                {
                    "id": "damage_roll",
                    "name": "Damage",
                    "roll_mode_kind": "damage",
                    "steps": [],
                }
            )
            state.actions["check_roll"] = Action.from_dict(
                {
                    "id": "check_roll",
                    "name": "Check",
                    "roll_mode_kind": "check",
                    "steps": [],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_template",
                    "action_id": "damage_roll",
                    "roll_mode": "advantage",
                },
            )
            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_template",
                    "action_id": "check_roll",
                    "roll_mode": "critical",
                },
            )

            assert "does not allow 'advantage'" in websocket.sent_messages[0]["reason"]
            assert "does not allow 'critical'" in websocket.sent_messages[1]["reason"]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_perform_action_applies_matching_equipped_item_numeric_modifier(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.actions["fire_damage"] = Action.from_dict(
                {
                    "id": "fire_damage",
                    "name": "Fire Damage",
                    "steps": [
                        {
                            "step_id": "damage-step",
                            "type": "resolve_damage",
                            "target": "caster",
                            "damage_type": "Fire",
                            "amount": _formula_payload("10"),
                        }
                    ],
                }
            )
            matching_template = _evaluation_augmentation_payload(
                augmentation_id="flame-focus",
                effect={
                    "type": "evaluation_formula_modifier",
                    "operation": "add",
                    "value": _formula_payload("5"),
                    "selector": {
                        "required_tags": ["damage", "fire"],
                        "action_id": "fire_damage",
                        "step_id": "damage-step",
                    },
                },
                source_id="focus",
            )
            mismatched_template = _evaluation_augmentation_payload(
                augmentation_id="cold-focus",
                effect={
                    "type": "evaluation_formula_modifier",
                    "operation": "add",
                    "value": _formula_payload("50"),
                    "selector": {"required_tags": ["damage", "ice"]},
                },
                source_id="focus",
            )
            inactive_template = _evaluation_augmentation_payload(
                augmentation_id="inactive-focus",
                effect={
                    "type": "evaluation_formula_modifier",
                    "operation": "add",
                    "value": _formula_payload("100"),
                    "selector": {"required_tags": ["damage", "fire"]},
                },
                source_id="inactive-focus",
            )
            state.items["focus"] = Item.from_dict(
                {
                    "id": "focus",
                    "name": "Flame Focus",
                    "interaction_type": "equippable",
                    "description": "Adds fire damage.",
                    "price": "0",
                    "weight": "0",
                    "augmentation_templates": [
                        matching_template,
                        mismatched_template,
                    ],
                }
            )
            state.items["inactive-focus"] = Item.from_dict(
                {
                    "id": "inactive-focus",
                    "name": "Inactive Focus",
                    "interaction_type": "equippable",
                    "description": "Must not apply while unequipped.",
                    "price": "0",
                    "weight": "0",
                    "augmentation_templates": [inactive_template],
                }
            )
            state.sheets["mage_template"].items = {
                "focus": ItemBridge(
                    relationship_id="focus",
                    count=1,
                    equipped=True,
                    item_id="focus",
                ),
                "inactive-focus": ItemBridge(
                    relationship_id="inactive-focus",
                    count=1,
                    equipped=False,
                    item_id="inactive-focus",
                ),
            }
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_instance",
                    "action_id": "fire_damage",
                },
            )

            assert state.instanced_sheets["mage_instance"].health == 75
            assert state.actions["fire_damage"].steps[0].amount.text == "10"
            assert state.items["focus"].augmentation_templates[0].applied is False
            assert len(state.augmentations) == 2
            assert all(
                augmentation.lifecycle_owner == "equipment"
                and augmentation.source.relationship_id == "focus"
                for augmentation in state.augmentations.values()
            )
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_perform_action_modifier_can_read_matched_action_fact(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.actions["fire_damage"] = Action.from_dict(
                {
                    "id": "fire_damage",
                    "name": "Fire Damage",
                    "facts": {
                        "action_base_spell_damage": {
                            "relationship_id": "spell-damage",
                            "fact_id": "action_base_spell_damage",
                            "value": {"type": "number", "value": 7},
                            "evaluated_value": 7,
                        }
                    },
                    "steps": [
                        {
                            "step_id": "damage-step",
                            "type": "resolve_damage",
                            "target": "caster",
                            "damage_type": "Fire",
                            "amount": _formula_payload("10", tags=["damage", "fire"]),
                        }
                    ],
                }
            )
            state.items["focus"] = Item.from_dict(
                {
                    "id": "focus",
                    "name": "Flame Focus",
                    "interaction_type": "equippable",
                    "description": "Adds current spell damage.",
                    "price": "0",
                    "weight": "0",
                    "augmentation_templates": [
                        _evaluation_augmentation_payload(
                            augmentation_id="spell-focus",
                            effect={
                                "type": "evaluation_formula_modifier",
                                "operation": "add",
                                "value": _formula_payload(
                                    "@spell_damage",
                                    [
                                        {
                                            "name": "spell_damage",
                                            "path": [
                                                "action",
                                                "facts",
                                                "action_base_spell_damage",
                                            ],
                                        }
                                    ],
                                ),
                                "selector": {"required_tags": ["damage", "fire"]},
                            },
                            source_id="focus",
                        )
                    ],
                }
            )
            state.sheets["mage_template"].items = {
                "focus": ItemBridge(
                    relationship_id="focus",
                    count=1,
                    equipped=True,
                    item_id="focus",
                )
            }
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_instance",
                    "action_id": "fire_damage",
                },
            )

            assert state.instanced_sheets["mage_instance"].health == 73
            assert websocket.sent_messages[-1]["type"] == "state_patch"
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_equipment_direct_effect_can_read_owning_item_fact(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            sheet = _build_sheet_state()
            sheet.items = {
                "focus": ItemBridge(
                    relationship_id="focus",
                    count=1,
                    equipped=True,
                    item_id="focus",
                )
            }
            state.sheets["mage_template"] = sheet
            state.actions["sync_probe"] = Action.from_dict(
                {"id": "sync_probe", "name": "Sync Probe", "steps": []}
            )
            state.items["focus"] = Item.from_dict(
                {
                    "id": "focus",
                    "name": "Strength Focus",
                    "interaction_type": "equippable",
                    "description": "",
                    "price": "",
                    "weight": "",
                    "fact_profile": "weapon",
                    "facts": {
                        "weapon_base_damage": {
                            "relationship_id": "focus-bonus",
                            "fact_id": "weapon_base_damage",
                            "value": {"type": "number", "value": 4},
                            "evaluated_value": 4,
                        }
                    },
                    "augmentation_templates": [
                        {
                            "id": "strength-bonus",
                            "name": "Strength Bonus",
                            "description": "",
                            "source": {
                                "type": "item",
                                "id": "focus",
                                "label": "Strength Focus",
                            },
                            "scope": "sheet",
                            "target": {
                                "root": "sheet",
                                "path": ["stats", "strength"],
                            },
                            "effect": {
                                "type": "formula_modifier",
                                "operation": "add",
                                "value": _formula_payload(
                                    "@bonus",
                                    [
                                        {
                                            "name": "bonus",
                                            "path": [
                                                "source_item",
                                                "facts",
                                                "weapon_base_damage",
                                            ],
                                        }
                                    ],
                                ),
                            },
                        }
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_template",
                    "action_id": "sync_probe",
                },
            )

            assert state.sheets["mage_template"].stats.strength == 14
            assert any(
                op["path"] == "/sheets/mage_template/stats/strength"
                for message in websocket.sent_messages
                if message["type"] == "state_patch"
                for op in message["ops"]
            )
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_item_modifier_source_item_fact_requires_explicit_source(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            sheet = _build_sheet_state()
            sheet.actions = {}
            sheet.items = {
                "sword": ItemBridge(
                    relationship_id="equipped-sword",
                    count=1,
                    equipped=True,
                    item_id="test-sword",
                )
            }
            state.sheets["mage_template"] = sheet
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.actions["weapon_damage"] = Action.from_dict(
                {
                    "id": "weapon_damage",
                    "name": "Weapon Damage",
                    "steps": [
                        {
                            "step_id": "damage-step",
                            "type": "resolve_damage",
                            "target": "caster",
                            "damage_type": "Slashing",
                            "amount": _formula_payload("10", tags=["damage"]),
                        }
                    ],
                }
            )
            state.items["test-sword"] = Item.from_dict(
                {
                    "id": "test-sword",
                    "name": "Test Sword",
                    "interaction_type": "equippable",
                    "description": "",
                    "price": "",
                    "weight": "",
                    "fact_profile": "weapon",
                    "action_grants": [
                        {
                            "action_id": "weapon_damage",
                            "availability": "equipped",
                        }
                    ],
                    "augmentation_templates": [
                        _evaluation_augmentation_payload(
                            augmentation_id="same-source-damage",
                            effect={
                                "type": "evaluation_formula_modifier",
                                "operation": "add",
                                "value": _formula_payload(
                                    "@base_damage",
                                    [
                                        {
                                            "name": "base_damage",
                                            "path": [
                                                "source_item",
                                                "facts",
                                                "weapon_base_damage",
                                            ],
                                        }
                                    ],
                                ),
                                "selector": {"required_tags": ["damage"]},
                            },
                            source_id="test-sword",
                        )
                    ],
                    "facts": {
                        "weapon_base_damage": {
                            "relationship_id": "weapon-damage",
                            "fact_id": "weapon_base_damage",
                            "value": {"type": "number", "value": 15},
                            "evaluated_value": 15,
                        }
                    },
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)

            request = {
                "type": "perform_action",
                "sheet_id": "mage_instance",
                "action_id": "weapon_damage",
            }
            await handle_client_payload(websocket, request)
            assert "requires an explicit eligible source item relationship" in (
                websocket.sent_messages[-1]["reason"]
            )
            assert state.instanced_sheets["mage_instance"].health == 90

            request["source_item_relationship_id"] = "equipped-sword"
            await handle_client_payload(websocket, request)

            assert state.instanced_sheets["mage_instance"].health == 65
            assert websocket.sent_messages[-1]["type"] == "state_patch"
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_perform_action_applies_matching_concrete_instance_modifier(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.actions["spend_mana"] = Action.from_dict(
                {
                    "id": "spend_mana",
                    "name": "Spend Mana",
                    "steps": [
                        {
                            "step_id": "mana-cost",
                            "type": "decrement_value",
                            "target": "caster",
                            "path": ["mana"],
                            "amount": _formula_payload("5", tags=["cost"]),
                        }
                    ],
                }
            )
            state.augmentations["double-cost"] = Augmentation.from_dict(
                _evaluation_augmentation_payload(
                    augmentation_id="double-cost",
                    effect={
                        "type": "evaluation_formula_modifier",
                        "operation": "multiply",
                        "value": _formula_payload("2"),
                        "selector": {
                            "required_tags": ["cost"],
                            "action_id": "spend_mana",
                            "step_id": "mana-cost",
                        },
                    },
                    source_type="condition",
                    source_id="mana-sickness",
                    applied=True,
                    applied_target_id="mage_instance",
                )
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_instance",
                    "action_id": "spend_mana",
                },
            )

            assert state.instanced_sheets["mage_instance"].mana == 20
            assert state.augmentations["double-cost"].applied is True
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_equipped_roll_mode_modifier_applies_and_cancels_requested_mode(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.actions["block"] = Action.from_dict(
                {
                    "id": "block",
                    "name": "Block",
                    "roll_mode_kind": "check",
                    "steps": [
                        {
                            "step_id": "block-roll",
                            "type": "send_message",
                            "message": _formula_payload(
                                "Block: /r (1d100 / 100) * 10",
                                tags=["check", "block"],
                            ),
                        }
                    ],
                }
            )
            shield_template = _evaluation_augmentation_payload(
                augmentation_id="shield-block-advantage",
                effect={
                    "type": "roll_mode_modifier",
                    "roll_mode": "advantage",
                    "selector": {
                        "required_tags": ["check", "block"],
                        "action_id": "block",
                        "step_id": "block-roll",
                    },
                },
                source_id="shield",
            )
            shield_check_bonus = _evaluation_augmentation_payload(
                augmentation_id="shield-block-bonus",
                effect={
                    "type": "evaluation_formula_modifier",
                    "operation": "add",
                    "value": _formula_payload("2"),
                    "selector": {
                        "required_tags": ["check", "block"],
                        "action_id": "block",
                        "step_id": "block-roll",
                    },
                },
                source_id="shield",
            )
            state.items["shield"] = Item.from_dict(
                {
                        "id": "shield",
                        "name": "Shield",
                        "interaction_type": "equippable",
                        "description": "Grants Block advantage.",
                    "price": "0",
                    "weight": "0",
                    "augmentation_templates": [shield_template, shield_check_bonus],
                }
            )
            state.sheets["mage_template"].items["shield"] = ItemBridge(
                relationship_id="shield",
                count=1,
                equipped=True,
                item_id="shield",
            )
            await websocket_sessions.reset()
            await chat_service.roll20_chat_bridge.reset()
            websocket = FakeWebSocket()
            bridge_socket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")
            await chat_service.roll20_chat_bridge.connect(bridge_socket)

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_instance",
                    "action_id": "block",
                    "roll_mode": "normal",
                },
            )
            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_instance",
                    "action_id": "block",
                    "roll_mode": "disadvantage",
                },
            )

            assert [message["message"] for message in bridge_socket.sent_messages] == [
                "Advantage Block: [[((2d100kh1 / 100) * 10) + (2)]]",
                "Block: [[((1d100 / 100) * 10) + (2)]]",
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_perform_action_rejects_roll_mode_without_d100_output(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            StateSingleton.getState().sheets["mage_template"] = _build_sheet_state()
            StateSingleton.getState().actions["damage_only"] = Action.from_dict(
                {
                    "id": "damage_only",
                    "name": "Damage Only",
                    "roll_mode_kind": "check",
                    "steps": [
                        {
                            "step_id": "roll",
                            "type": "send_message",
                            "message": _formula_payload("Damage: /r 2d8 + 4"),
                        }
                    ],
                }
            )
            await websocket_sessions.reset()
            await chat_service.roll20_chat_bridge.reset()
            websocket = FakeWebSocket()
            bridge_socket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")
            await chat_service.roll20_chat_bridge.connect(bridge_socket)

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_template",
                    "action_id": "damage_only",
                    "roll_mode": "disadvantage",
                },
            )

            assert websocket.sent_messages[0]["type"] == "error"
            assert websocket.sent_messages[0]["reason"] == (
                "Roll mode 'disadvantage' requires an authored 1d100 "
                "Roll20 check expression."
            )
            assert bridge_socket.sent_messages == []
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_player_cannot_perform_action_against_base_sheet(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            StateSingleton.getState().sheets["mage_template"] = _build_sheet_state()
            StateSingleton.getState().actions["battle_cry"] = Action.from_dict(
                {
                    "id": "battle_cry",
                    "name": "Battle Cry",
                    "steps": [
                        {
                            "step_id": "step-1",
                            "type": "set_value",
                            "target": "caster",
                            "path": ["stats", "strength"],
                            "value": _formula_payload("8"),
                        },
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_template",
                    "action_id": "battle_cry",
                },
            )

            assert StateSingleton.getState().sheets["mage_template"].stats.strength == 10
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Players can only execute actions against an instanced sheet.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_player_cannot_perform_action_with_target_sheet(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.actions["battle_cry"] = Action.from_dict(
                {
                    "id": "battle_cry",
                    "name": "Battle Cry",
                    "steps": [
                        {
                            "step_id": "step-1",
                            "type": "decrement_value",
                            "target": "caster",
                            "path": ["mana"],
                            "amount": _formula_payload("5"),
                        },
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_instance",
                    "target_sheet_id": "other_instance",
                    "action_id": "battle_cry",
                },
            )

            assert state.instanced_sheets["mage_instance"].mana == 30
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": (
                        "Target sheet execution is not supported for MVP; "
                        "actions can only affect the acting sheet or instance."
                    ),
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_cannot_perform_action_with_target_sheet(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.actions["battle_cry"] = Action.from_dict(
                {
                    "id": "battle_cry",
                    "name": "Battle Cry",
                    "steps": [
                        {
                            "step_id": "step-1",
                            "type": "set_value",
                            "target": "caster",
                            "path": ["stats", "strength"],
                            "value": _formula_payload("8"),
                        },
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_template",
                    "target_sheet_id": "other_template",
                    "action_id": "battle_cry",
                },
            )

            assert state.sheets["mage_template"].stats.strength == 10
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": (
                        "Target sheet execution is not supported for MVP; "
                        "actions can only affect the acting sheet or instance."
                    ),
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_perform_action_rejects_missing_sheet_or_instance(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "missing_instance",
                    "action_id": "battle_cry",
                },
            )

            assert StateSingleton.getState().sheets == {}
            assert StateSingleton.getState().instanced_sheets == {}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Sheet or instance 'missing_instance' does not exist.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_perform_action_rejects_missing_action(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_instance",
                    "action_id": "missing_action",
                },
            )

            assert state.instanced_sheets["mage_instance"].mana == 30
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Action 'missing_action' does not exist.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_perform_action_rejects_blank_payload_ids(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "",
                    "action_id": "",
                    "target_sheet_id": "",
                },
            )

            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": (
                        "sheet_id: String should have at least 1 character; "
                        "action_id: String should have at least 1 character; "
                        "target_sheet_id: String should have at least 1 character"
                    ),
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_player_cannot_perform_unassigned_action(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.sheets["mage_template"].actions = {}
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.actions["unassigned"] = Action.from_dict(
                {
                    "id": "unassigned",
                    "name": "Unassigned",
                    "steps": [
                        {
                            "step_id": "step-1",
                            "type": "decrement_value",
                            "target": "caster",
                            "path": ["mana"],
                            "amount": _formula_payload("1"),
                        },
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_instance",
                    "action_id": "unassigned",
                },
            )

            assert state.instanced_sheets["mage_instance"].mana == 30
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": (
                        "Sheet 'mage_template' does not reference action "
                        "'unassigned'."
                    ),
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_player_item_granted_action_requires_source_when_ambiguous_and_consumes(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            sheet = _build_sheet_state()
            sheet.actions = {}
            sheet.items = {
                "potion-a": ItemBridge(
                    relationship_id="potion-a",
                    count=1,
                    equipped=False,
                    item_id="healing-potion",
                ),
                "potion-b": ItemBridge(
                    relationship_id="potion-b",
                    count=1,
                    equipped=False,
                    item_id="healing-potion",
                ),
            }
            state.sheets["mage_template"] = sheet
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.actions["drink_potion"] = Action.from_dict(
                {
                    "id": "drink_potion",
                    "name": "Drink Potion",
                    "steps": [
                        {
                            "step_id": "heal",
                            "type": "increment_value",
                            "target": "caster",
                            "path": ["health"],
                            "amount": _formula_payload("5"),
                        }
                    ],
                }
            )
            state.items["healing-potion"] = Item.from_dict(
                {
                        "id": "healing-potion",
                        "name": "Healing Potion",
                        "interaction_type": "consumable",
                        "description": "",
                    "price": "",
                    "weight": "",
                    "action_grants": [
                        {
                            "action_id": "drink_potion",
                            "availability": "carried",
                            "consume_quantity": 1,
                        }
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_instance",
                    "action_id": "drink_potion",
                },
            )
            assert "Multiple items grant action" in websocket.sent_messages[-1]["reason"]
            assert state.instanced_sheets["mage_instance"].health == 90

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_instance",
                    "action_id": "drink_potion",
                    "source_item_relationship_id": "potion-b",
                },
            )

            assert state.instanced_sheets["mage_instance"].health == 95
            assert sheet.items["potion-a"].count == 1
            assert sheet.items["potion-b"].count == 0
            assert websocket.sent_messages[-1]["ops"] == [
                {
                    "op": "inc",
                    "path": "/instanced_sheets/mage_instance/health",
                    "value": 5,
                },
                {
                    "op": "inc",
                    "path": "/sheets/mage_template/items/potion-b/count",
                    "value": -1,
                },
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_action_formula_reads_evaluated_action_fact(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            sheet = _build_sheet_state()
            sheet.actions = {
                "spell": Bridge(relationship_id="spell", entry_id="spell_burst")
            }
            state.sheets["mage_template"] = sheet
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.actions["spell_burst"] = Action.from_dict(
                {
                    "id": "spell_burst",
                    "name": "Spell Burst",
                    "facts": {
                        "action_base_spell_damage": {
                            "relationship_id": "spell-damage",
                            "fact_id": "action_base_spell_damage",
                            "value": {"type": "number", "value": 12},
                            "evaluated_value": None,
                            "evaluation_error": "broken test formula",
                        }
                    },
                    "steps": [
                        {
                            "step_id": "gain-mana-for-test",
                            "type": "increment_value",
                            "path": ["mana"],
                            "amount": _formula_payload(
                                "@base_spell_damage",
                                [
                                    {
                                        "name": "base_spell_damage",
                                        "path": [
                                            "action",
                                            "facts",
                                            "action_base_spell_damage",
                                        ],
                                    }
                                ],
                            ),
                        }
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)

            request = {
                "type": "perform_action",
                "sheet_id": "mage_instance",
                "action_id": "spell_burst",
            }
            await handle_client_payload(websocket, request)
            assert "references invalid Fact 'action_base_spell_damage'" in (
                websocket.sent_messages[-1]["reason"]
            )
            assert state.instanced_sheets["mage_instance"].mana == 30

            damage_fact = state.actions["spell_burst"].facts[
                "action_base_spell_damage"
            ]
            damage_fact.evaluated_value = 12
            damage_fact.evaluation_error = None
            await handle_client_payload(websocket, request)

            assert state.instanced_sheets["mage_instance"].mana == 42
            assert websocket.sent_messages[-1]["type"] == "state_patch"
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_weapon_formula_requires_explicit_source_and_resolves_weapon_values(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            sheet = _build_sheet_state()
            sheet.actions = {}
            sheet.proficiencies = {
                "swords": ProficiencyBridge(
                    relationship_id="sheet-swords",
                    prof_id="swords",
                    use_count=4,
                    growth_rate=0.2,
                )
            }
            sheet.items = {
                "sword": ItemBridge(
                    relationship_id="equipped-sword",
                    count=1,
                    equipped=True,
                    item_id="test-sword",
                )
            }
            state.proficiencies["swords"] = Proficiency(
                id="swords",
                name="Swords",
                description="Sword proficiency.",
            )
            state.sheets["mage_template"] = sheet
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.actions["weapon_test"] = Action.from_dict(
                {
                    "id": "weapon_test",
                    "name": "Weapon Test",
                    "steps": [
                        {
                            "step_id": "resolve",
                            "type": "calculate_value",
                            "variable_id": "weapon_total",
                            "value": _formula_payload(
                                "@base_damage + @weapon_stat + @weapon_proficiency",
                                [
                                    {
                                        "name": "base_damage",
                                        "path": [
                                            "source_item",
                                            "facts",
                                            "weapon_base_damage",
                                        ],
                                    },
                                    {
                                        "name": "weapon_stat",
                                        "path": [
                                            "source_item",
                                            "resolved",
                                            "governing_stat",
                                        ],
                                    },
                                    {
                                        "name": "weapon_proficiency",
                                        "path": [
                                            "source_item",
                                            "resolved",
                                            "proficiency_modifier",
                                        ],
                                    },
                                ],
                            ),
                        },
                        {
                            "step_id": "apply",
                            "type": "increment_value",
                            "path": ["mana"],
                            "amount": {
                                "type": "calculated_value",
                                "variable_id": "weapon_total",
                            },
                        }
                    ],
                }
            )
            state.items["test-sword"] = Item.from_dict(
                {
                    "id": "test-sword",
                    "name": "Test Sword",
                    "interaction_type": "equippable",
                    "description": "",
                    "price": "",
                    "weight": "",
                    "fact_profile": "weapon",
                    "action_grants": [
                        {
                            "action_id": "weapon_test",
                            "availability": "equipped",
                        }
                    ],
                    "facts": {
                        "weapon_base_damage": {
                            "relationship_id": "weapon-damage",
                            "fact_id": "weapon_base_damage",
                            "value": {"type": "number", "value": 15},
                            "evaluated_value": 15,
                        },
                        "weapon_governing_stat": {
                            "relationship_id": "weapon-stat",
                            "fact_id": "weapon_governing_stat",
                            "value": {"type": "enum", "value": "strength"},
                            "evaluated_value": "strength",
                        },
                        "weapon_proficiency": {
                            "relationship_id": "weapon-prof",
                            "fact_id": "weapon_proficiency",
                            "value": {"type": "reference", "value": "swords"},
                            "evaluated_value": "swords",
                        },
                    },
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)
            request = {
                "type": "perform_action",
                "sheet_id": "mage_instance",
                "action_id": "weapon_test",
            }

            await handle_client_payload(websocket, request)
            assert "requires an explicit eligible source item" in (
                websocket.sent_messages[-1]["reason"]
            )
            assert state.instanced_sheets["mage_instance"].mana == 30

            request["source_item_relationship_id"] = "equipped-sword"
            state.items["test-sword"].fact_profile = None
            await handle_client_payload(websocket, request)
            assert "requires source-item profile 'weapon'" in (
                websocket.sent_messages[-1]["reason"]
            )
            assert state.instanced_sheets["mage_instance"].mana == 30

            state.items["test-sword"].fact_profile = "weapon"
            await handle_client_payload(websocket, request)

            assert state.instanced_sheets["mage_instance"].mana == 55.8
            assert websocket.sent_messages[-1]["type"] == "state_patch"
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_equipped_item_granted_action_requires_equipped_bridge(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            sheet = _build_sheet_state()
            sheet.actions = {}
            sheet.items = {
                "sword": ItemBridge(
                    relationship_id="sword",
                    count=1,
                    equipped=False,
                    item_id="moon-sword",
                )
            }
            state.sheets["mage_template"] = sheet
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.actions["moon_strike"] = Action.from_dict(
                {"id": "moon_strike", "name": "Moon Strike", "steps": []}
            )
            state.items["moon-sword"] = Item.from_dict(
                {
                    "id": "moon-sword",
                    "name": "Moon Sword",
                    "interaction_type": "equippable",
                    "description": "",
                    "price": "",
                    "weight": "",
                    "action_grants": [
                        {
                            "action_id": "moon_strike",
                            "availability": "equipped",
                            "consume_quantity": 1,
                        }
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)
            request = {
                "type": "perform_action",
                "sheet_id": "mage_instance",
                "action_id": "moon_strike",
                "source_item_relationship_id": "sword",
            }

            await handle_client_payload(websocket, request)
            assert "must be equipped" in websocket.sent_messages[-1]["reason"]

            sheet.items["sword"].equipped = True
            await handle_client_payload(websocket, request)
            assert websocket.sent_messages[-1]["ops"] == [
                {
                    "op": "inc",
                    "path": "/sheets/mage_template/items/sword/count",
                    "value": -1,
                },
                {
                    "op": "set",
                    "path": "/sheets/mage_template/items/sword/equipped",
                    "value": False,
                },
            ]
            assert sheet.items["sword"].count == 0
            assert sheet.items["sword"].equipped is False
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_admin_execute_unassigned_action(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.sheets["mage_template"].actions = {}
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.actions["unassigned"] = Action.from_dict(
                {
                    "id": "unassigned",
                    "name": "Unassigned",
                    "steps": [
                        {
                            "step_id": "step-1",
                            "type": "decrement_value",
                            "target": "caster",
                            "path": ["mana"],
                            "amount": _formula_payload("1"),
                        },
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_instance",
                    "action_id": "unassigned",
                },
            )

            assert state.instanced_sheets["mage_instance"].mana == 29
            assert websocket.sent_messages[0]["ops"] == [
                {
                    "op": "inc",
                    "path": "/instanced_sheets/mage_instance/mana",
                    "value": -1,
                }
            ]
            assert len(websocket.sent_messages) == 1
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_perform_action_can_increment_and_decrement_instance_values(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.sheets["mage_template"].actions["spell"] = Bridge.from_dict(
                {
                    "relationship_id": "bridge-2",
                    "entry_id": "cast_spell",
                }
            )
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.actions["cast_spell"] = Action.from_dict(
                {
                    "id": "cast_spell",
                    "name": "Cast Spell",
                    "notes": "Spend mana and heal.",
                    "steps": [
                        {
                            "step_id": "step-1",
                            "type": "decrement_value",
                            "target": "caster",
                            "path": ["mana"],
                            "amount": _formula_payload("7"),
                        },
                        {
                            "step_id": "step-2",
                            "type": "increment_value",
                            "target": "caster",
                            "path": ["health"],
                            "amount": _formula_payload(
                                "@arcane / 2",
                                [{"name": "arcane", "path": ["stats", "arcane"]}],
                            ),
                        },
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_instance",
                    "action_id": "cast_spell",
                },
            )

            assert state.instanced_sheets["mage_instance"].mana == 23
            assert state.instanced_sheets["mage_instance"].health == 97
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "inc",
                            "path": "/instanced_sheets/mage_instance/mana",
                            "value": -7,
                        },
                        {
                            "op": "inc",
                            "path": "/instanced_sheets/mage_instance/health",
                            "value": 7,
                        },
                    ],
                    "state_version": 1,
                    "type": "state_patch",
                    "request_id": "req-1",
                },
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_perform_action_rejects_incrementing_nonnumeric_instance_path(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.sheets["mage_template"].actions["bad"] = Bridge.from_dict(
                {
                    "relationship_id": "bridge-2",
                    "entry_id": "bad_action",
                }
            )
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.actions["bad_action"] = Action.from_dict(
                {
                    "id": "bad_action",
                    "name": "Bad Action",
                    "steps": [
                        {
                            "step_id": "step-1",
                            "type": "increment_value",
                            "target": "caster",
                            "path": ["parent_id"],
                            "amount": _formula_payload("1"),
                        },
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_instance",
                    "action_id": "bad_action",
                },
            )

            assert state.instanced_sheets["mage_instance"].parent_id == "mage_template"
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "State path /instanced_sheets/mage_instance/parent_id is not numeric.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_perform_action_spends_instance_resource_and_gains_proficiency_use(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.sheets["mage_template"].actions["spell"] = Bridge.from_dict(
                {
                    "relationship_id": "bridge-2",
                    "entry_id": "focused_cast",
                }
            )
            state.sheets["mage_template"].proficiencies["magic"] = (
                ProficiencyBridge.from_dict(
                    {
                        "relationship_id": "prof-bridge-1",
                        "prof_id": "magic_prof",
                        "use_count": 2,
                        "growth_rate": 0.2,
                    }
                )
            )
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.actions["focused_cast"] = Action.from_dict(
                {
                    "id": "focused_cast",
                    "name": "Focused Cast",
                    "steps": [
                        {
                            "step_id": "step-1",
                            "type": "decrement_value",
                            "target": "caster",
                            "path": ["mana"],
                            "amount": _formula_payload("8"),
                            "min_value": _formula_payload("0"),
                            "on_min_violation": "reject",
                        },
                        {
                            "step_id": "step-2",
                            "type": "gain_proficiency_use",
                            "target": "caster",
                            "proficiency_id": "magic_prof",
                            "amount": _formula_payload("1"),
                        },
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_instance",
                    "action_id": "focused_cast",
                },
            )

            assert state.instanced_sheets["mage_instance"].mana == 22
            assert state.sheets["mage_template"].proficiencies["magic"].use_count == 3
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "set",
                            "path": "/instanced_sheets/mage_instance/mana",
                            "value": 22,
                        },
                        {
                            "op": "inc",
                            "path": "/sheets/mage_template/proficiencies/magic/use_count",
                            "value": 1,
                        },
                    ],
                    "state_version": 1,
                    "type": "state_patch",
                    "request_id": "req-1",
                },
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_perform_action_applies_instance_augmentation_step(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.sheets["mage_template"].actions["ward"] = Bridge.from_dict(
                {
                    "relationship_id": "bridge-ward",
                    "entry_id": "ward",
                }
            )
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.standalone_effects["shielded"] = _build_standalone_effect_state()
            state.actions["ward"] = Action.from_dict(
                {
                    "id": "ward",
                    "name": "Ward",
                    "steps": [
                        {
                            "step_id": "step-1",
                            "type": "apply_augmentation",
                            "target": "caster",
                            "augmentation_id": "shielded",
                            "operation": "apply",
                        }
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_instance",
                    "action_id": "ward",
                },
            )

            assert state.instanced_sheets["mage_instance"].health == 95
            application_id = "standalone:mage_instance:shielded"
            application = state.standalone_effect_applications[application_id]
            assert application.definition_id == "shielded"
            assert application.source.id == "ward"
            assert application.source.relationship_id == "step-1"
            assert [op["path"] for op in websocket.sent_messages[0]["ops"]] == [
                f"/standalone_effect_applications/{application_id}",
                "/instanced_sheets/mage_instance/health",
            ]
            assert len(websocket.sent_messages) == 1
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_perform_action_applies_condition_preset_step(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.sheets["mage_template"].actions["poison"] = Bridge.from_dict(
                {
                    "relationship_id": "bridge-poison",
                    "entry_id": "poison",
                }
            )
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.condition_presets["poisoned"] = _build_condition_preset_state()
            state.actions["poison"] = Action.from_dict(
                {
                    "id": "poison",
                    "name": "Poison",
                    "steps": [
                        {
                            "step_id": "step-1",
                            "type": "apply_condition_preset",
                            "target": "caster",
                            "condition_id": "poisoned",
                            "operation": "apply",
                        }
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_instance",
                    "action_id": "poison",
                },
            )

            concrete_id = "condition:poisoned:mage_instance:poison-drain"
            assert state.instanced_sheets["mage_instance"].health == 85
            assert concrete_id in state.augmentations
            assert state.instanced_sheets["mage_instance"].augments[
                concrete_id
            ].entry_id == concrete_id
            assert [op["path"] for op in websocket.sent_messages[0]["ops"]] == [
                "/active_conditions/condition:poisoned:mage_instance",
                f"/augmentations/{concrete_id}",
                f"/instanced_sheets/mage_instance/augments/{concrete_id}",
                "/instanced_sheets/mage_instance/health",
                f"/augmentations/{concrete_id}/applied",
                f"/augmentations/{concrete_id}/applied_target_id",
            ]
            assert len(websocket.sent_messages) == 1
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_apply_condition_step_requires_instance(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.condition_presets["poisoned"] = _build_condition_preset_state()
            state.actions["poison"] = Action.from_dict(
                {
                    "id": "poison",
                    "name": "Poison",
                    "steps": [
                        {
                            "step_id": "step-1",
                            "type": "apply_condition_preset",
                            "target": "caster",
                            "condition_id": "poisoned",
                        }
                    ],
                }
            )
            state.sheets["mage_template"].actions["poison"] = Bridge.from_dict(
                {
                    "relationship_id": "bridge-poison",
                    "entry_id": "poison",
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_template",
                    "action_id": "poison",
                },
            )

            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": (
                        "Apply condition preset steps require an instanced sheet."
                    ),
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_apply_semantic_steps_reject_missing_records(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.sheets["mage_template"].actions["ward"] = Bridge.from_dict(
                {
                    "relationship_id": "bridge-ward",
                    "entry_id": "ward",
                }
            )
            state.actions["ward"] = Action.from_dict(
                {
                    "id": "ward",
                    "name": "Ward",
                    "steps": [
                        {
                            "step_id": "step-1",
                            "type": "apply_augmentation",
                            "target": "caster",
                            "augmentation_id": "missing",
                        }
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_instance",
                    "action_id": "ward",
                },
            )

            assert websocket.sent_messages == [
                {
                    "response_id": None,
                        "reason": "Standalone effect 'missing' does not exist.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]

            state.actions["ward"] = Action.from_dict(
                {
                    "id": "ward",
                    "name": "Ward",
                    "steps": [
                        {
                            "step_id": "step-1",
                            "type": "apply_condition_preset",
                            "target": "caster",
                            "condition_id": "missing",
                        }
                    ],
                }
            )
            websocket.sent_messages.clear()

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_instance",
                    "action_id": "ward",
                },
            )

            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Condition preset 'missing' does not exist.",
                    "type": "error",
                    "request_id": "req-2",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_apply_augmentation_step_rejects_target_runtime(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.augmentations["shielded"] = _build_augmentation_state()
            state.sheets["mage_template"].actions["ward"] = Bridge.from_dict(
                {
                    "relationship_id": "bridge-ward",
                    "entry_id": "ward",
                }
            )
            state.actions["ward"] = Action.from_dict(
                {
                    "id": "ward",
                    "name": "Ward",
                    "steps": [
                        {
                            "step_id": "step-1",
                            "type": "apply_augmentation",
                            "target": "target",
                            "augmentation_id": "shielded",
                        }
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_instance",
                    "action_id": "ward",
                },
            )

            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Unsupported runtime action target 'target'.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_perform_action_rejects_resource_overspend_without_patch(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.sheets["mage_template"].actions["spell"] = Bridge.from_dict(
                {
                    "relationship_id": "bridge-2",
                    "entry_id": "overcast",
                }
            )
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.actions["overcast"] = Action.from_dict(
                {
                    "id": "overcast",
                    "name": "Overcast",
                    "steps": [
                        {
                            "step_id": "step-1",
                            "type": "decrement_value",
                            "target": "caster",
                            "path": ["mana"],
                            "amount": _formula_payload("40"),
                            "min_value": _formula_payload("0"),
                            "on_min_violation": "reject",
                        },
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_instance",
                    "action_id": "overcast",
                },
            )

            assert state.instanced_sheets["mage_instance"].mana == 30
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "State path /instanced_sheets/mage_instance/mana would be below minimum 0.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_perform_action_applies_resisted_damage_to_instance_health(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.sheets["mage_template"].resistances.resistance = 0.5
            state.sheets["mage_template"].resistances.magical = 0.25
            state.sheets["mage_template"].actions["damage"] = Bridge.from_dict(
                {
                    "relationship_id": "bridge-2",
                    "entry_id": "take_damage",
                }
            )
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.instanced_sheets["mage_instance"].resistances.fire = 0.125
            state.actions["take_damage"] = Action.from_dict(
                {
                    "id": "take_damage",
                    "name": "Take Damage",
                    "steps": [
                        {
                            "step_id": "step-1",
                            "type": "resolve_damage",
                            "target": "caster",
                            "damage_type": "Fire",
                            "amount": _formula_payload("80"),
                        },
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_instance",
                    "action_id": "take_damage",
                },
            )

            assert state.instanced_sheets["mage_instance"].health == 80
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "set",
                            "path": "/instanced_sheets/mage_instance/health",
                            "value": 80,
                        },
                    ],
                    "state_version": 1,
                    "type": "state_patch",
                    "request_id": "req-1",
                },
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_perform_action_caps_damage_resistance_at_100_percent(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.sheets["mage_template"].resistances.resistance = 0.75
            state.sheets["mage_template"].resistances.magical = 0.5
            state.sheets["mage_template"].actions["damage"] = Bridge.from_dict(
                {
                    "relationship_id": "bridge-2",
                    "entry_id": "blocked_damage",
                }
            )
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.actions["blocked_damage"] = Action.from_dict(
                {
                    "id": "blocked_damage",
                    "name": "Blocked Damage",
                    "steps": [
                        {
                            "step_id": "step-1",
                            "type": "resolve_damage",
                            "target": "caster",
                            "damage_type": "Arcane",
                            "amount": _formula_payload("25"),
                        },
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_instance",
                    "action_id": "blocked_damage",
                },
            )

            assert state.instanced_sheets["mage_instance"].health == 90
            assert websocket.sent_messages[0]["ops"] == [
                {
                    "op": "set",
                    "path": "/instanced_sheets/mage_instance/health",
                    "value": 90,
                }
            ]
            assert len(websocket.sent_messages) == 1
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_resolve_damage_step_clamps_health_at_zero(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.sheets["mage_template"].actions["damage"] = Bridge.from_dict(
                {
                    "relationship_id": "bridge-2",
                    "entry_id": "massive_damage",
                }
            )
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.actions["massive_damage"] = Action.from_dict(
                {
                    "id": "massive_damage",
                    "name": "Massive Damage",
                    "steps": [
                        {
                            "step_id": "step-1",
                            "type": "resolve_damage",
                            "target": "caster",
                            "damage_type": "Bludgeoning",
                            "amount": _formula_payload("200"),
                        },
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_instance",
                    "action_id": "massive_damage",
                },
            )

            assert state.instanced_sheets["mage_instance"].health == 0
            assert websocket.sent_messages[0]["ops"] == [
                {
                    "op": "set",
                    "path": "/instanced_sheets/mage_instance/health",
                    "value": 0,
                }
            ]
            assert len(websocket.sent_messages) == 1
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_resolve_damage_step_requires_instance(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.sheets["mage_template"].actions["damage"] = Bridge.from_dict(
                {
                    "relationship_id": "bridge-2",
                    "entry_id": "take_damage",
                }
            )
            state.actions["take_damage"] = Action.from_dict(
                {
                    "id": "take_damage",
                    "name": "Take Damage",
                    "steps": [
                        {
                            "step_id": "step-1",
                            "type": "resolve_damage",
                            "target": "caster",
                            "damage_type": "Slashing",
                            "amount": _formula_payload("10"),
                        },
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_template",
                    "action_id": "take_damage",
                },
            )

            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Resolve damage steps require an instanced sheet.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_resolve_damage_step_rejects_negative_amount(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.sheets["mage_template"].actions["damage"] = Bridge.from_dict(
                {
                    "relationship_id": "bridge-2",
                    "entry_id": "bad_damage",
                }
            )
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.actions["bad_damage"] = Action.from_dict(
                {
                    "id": "bad_damage",
                    "name": "Bad Damage",
                    "steps": [
                        {
                            "step_id": "step-1",
                            "type": "resolve_damage",
                            "target": "caster",
                            "damage_type": "Fire",
                            "amount": _formula_payload("-1"),
                        },
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_instance",
                    "action_id": "bad_damage",
                },
            )

            assert state.instanced_sheets["mage_instance"].health == 90
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Damage amount must be greater than or equal to 0.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_perform_action_applies_healing_to_instance_health_with_max_clamp(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.sheets["mage_template"].actions["heal"] = Bridge.from_dict(
                {
                    "relationship_id": "bridge-2",
                    "entry_id": "heal_wounds",
                }
            )
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.instanced_sheets["mage_instance"].health = 115
            state.actions["heal_wounds"] = Action.from_dict(
                {
                    "id": "heal_wounds",
                    "name": "Heal Wounds",
                    "steps": [
                        {
                            "step_id": "step-1",
                            "type": "increment_value",
                            "target": "caster",
                            "path": ["health"],
                            "amount": _formula_payload("20"),
                            "max_value": _formula_payload(
                                "@max_health",
                                [{"name": "max_health", "path": ["stats", "health"]}],
                            ),
                        },
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_instance",
                    "action_id": "heal_wounds",
                },
            )

            assert state.instanced_sheets["mage_instance"].health == 120
            assert websocket.sent_messages[0]["ops"] == [
                {
                    "op": "set",
                    "path": "/instanced_sheets/mage_instance/health",
                    "value": 120,
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_perform_action_can_apply_bounded_decrement_against_base_sheet(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.sheets["mage_template"].actions["damage"] = Bridge.from_dict(
                {
                    "relationship_id": "bridge-2",
                    "entry_id": "take_damage",
                }
            )
            state.actions["take_damage"] = Action.from_dict(
                {
                    "id": "take_damage",
                    "name": "Take Damage",
                    "steps": [
                        {
                            "step_id": "step-1",
                            "type": "decrement_value",
                            "target": "caster",
                            "path": ["stats", "strength"],
                            "amount": _formula_payload("15"),
                            "min_value": _formula_payload("0"),
                        },
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_template",
                    "action_id": "take_damage",
                },
            )

            assert state.sheets["mage_template"].stats.strength == 0
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "set",
                            "path": "/sheets/mage_template/stats/strength",
                            "value": 0,
                        },
                    ],
                    "state_version": 1,
                    "type": "state_patch",
                    "request_id": "req-1",
                },
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())
