import asyncio
from copy import deepcopy
from dataclasses import asdict

import pytest

from backend.features.chat import service as chat_service
from backend.features.sheet_runtime import service as runtime_service
from backend.features.sheet_runtime.schema import PerformAction
from backend.features.state_sync.service import state_sync_service
from backend.routes.ws import handle_client_payload, websocket_sessions
from backend.state.models.augmentation import Augmentation
from backend.state.models.action import Action
from backend.state.models.condition import ConditionPreset
from backend.state.models.proficiency import ProficiencyBridge
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


def test_roll20_action_output_wraps_roll_modes_and_gm_visibility() -> None:
    message = "Attack: /r (1d100 / 100) * 10"

    assert runtime_service.format_roll20_message(
        message,
        roll_mode="advantage",
        visibility="public",
    ) == (
        "Attack: [[{(1d100 / 100) * 10, (1d100 / 100) * 10}kh1]]"
    )
    assert runtime_service.format_roll20_message(
        "/r 1d100",
        roll_mode="normal",
        visibility="public",
    ) == "/r 1d100"
    assert runtime_service.format_roll20_message(
        message,
        roll_mode="disadvantage",
        visibility="gm_only",
    ) == (
        "/w gm Attack: "
        "[[{(1d100 / 100) * 10, (1d100 / 100) * 10}kl1]]"
    )
    assert runtime_service.format_roll20_message(
        "The door opens.",
        roll_mode="normal",
        visibility="gm_only",
    ) == "/w gm The door opens."


def test_action_runtime_parameters_reject_invalid_visibility_and_nonroll_modes() -> None:
    nonroll_action = Action.from_dict(
        {
            "id": "announce",
            "name": "Announce",
            "steps": [
                {
                    "step_id": "message",
                    "type": "send_message",
                    "message": {"aliases": None, "text": "Hello"},
                }
            ],
        }
    )

    with pytest.raises(PermissionError, match="Only a DM"):
        runtime_service.validate_action_runtime_parameters(
            PerformAction(
                type="perform_action",
                sheet_id="instance-1",
                action_id="announce",
                visibility="gm_only",
            ),
            actor_role="player",
            action=nonroll_action,
        )

    with pytest.raises(ValueError, match="requires an action with a Roll20 /r"):
        runtime_service.validate_action_runtime_parameters(
            PerformAction(
                type="perform_action",
                sheet_id="instance-1",
                action_id="announce",
                roll_mode="advantage",
            ),
            actor_role="dm",
            action=nonroll_action,
        )


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


def _formula_payload(text: str, aliases: list[dict] | None = None) -> dict:
    return {
        "aliases": aliases,
        "text": text,
    }


def _build_sheet_state() -> Sheet:
    return Sheet.from_dict(
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


def _build_instance_state() -> InstancedSheet:
    return InstancedSheet.from_dict(
        {
            "parent_id": "mage_template",
            "health": 90,
            "mana": 30,
            "augments": {},
        }
    )


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
            assert websocket.sent_messages[0] == {
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
                }
            assert websocket.sent_messages[1]["type"] == "action_executed"
            assert websocket.sent_messages[1]["action_id"] == "battle_cry"
            assert websocket.sent_messages[1]["request_id"] == "req-4"
            assert bridge_socket.sent_messages == [
                {
                    "message_id": bridge_socket.sent_messages[0]["message_id"],
                    "message": "Strength now (8)",
                    "type": "chat_message",
                    "request_id": "req-4",
                }
            ]
            mutation_audit = state_sync_service.mutation_history[-1]
            assert mutation_audit.state_version == 1
            assert mutation_audit.request_id == "req-4"
            assert mutation_audit.request_type == "perform_action"
            assert mutation_audit.action_id == "battle_cry"
            assert mutation_audit.sheet_id == "mage_template"
            assert mutation_audit.operation_paths == (
                "/sheets/mage_template/stats/strength",
            )
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
            assert websocket.sent_messages[0] == {
                    "response_id": None,
                    "reason": (
                        "Target sheet execution is not supported for MVP; "
                        "actions can only affect the acting sheet or instance."
                    ),
                    "type": "error",
                    "request_id": "req-1",
                }
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
            assert websocket.sent_messages[0] == {
                    "response_id": None,
                    "reason": (
                        "Target sheet execution is not supported for MVP; "
                        "actions can only affect the acting sheet or instance."
                    ),
                    "type": "error",
                    "request_id": "req-1",
                }
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
            assert websocket.sent_messages[1]["type"] == "action_executed"
            assert websocket.sent_messages[1]["action_id"] == "unassigned"
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
            assert websocket.sent_messages[0] == {
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
                }
            assert websocket.sent_messages[1]["type"] == "action_executed"
            assert websocket.sent_messages[1]["action_id"] == "cast_spell"
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
            assert websocket.sent_messages[0] == {
                    "response_id": None,
                    "reason": "State path /instanced_sheets/mage_instance/parent_id is not numeric.",
                    "type": "error",
                    "request_id": "req-1",
                }
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
            assert websocket.sent_messages[0] == {
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
                }
            assert websocket.sent_messages[1]["type"] == "action_executed"
            assert websocket.sent_messages[1]["action_id"] == "focused_cast"
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
            state.augmentations["shielded"] = _build_augmentation_state()
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
            assert state.augmentations["shielded"].applied is True
            assert state.augmentations["shielded"].applied_target_id == "mage_instance"
            assert websocket.sent_messages[0]["ops"] == [
                {
                    "op": "set",
                    "path": "/instanced_sheets/mage_instance/health",
                    "value": 95,
                },
                {
                    "op": "set",
                    "path": "/augmentations/shielded/applied",
                    "value": True,
                },
                {
                    "op": "set",
                    "path": "/augmentations/shielded/applied_target_id",
                    "value": "mage_instance",
                },
            ]
            assert websocket.sent_messages[1]["type"] == "action_executed"
            assert websocket.sent_messages[1]["action_id"] == "ward"
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
                f"/augmentations/{concrete_id}",
                f"/instanced_sheets/mage_instance/augments/{concrete_id}",
                "/instanced_sheets/mage_instance/health",
                f"/augmentations/{concrete_id}/applied",
                f"/augmentations/{concrete_id}/applied_target_id",
            ]
            assert websocket.sent_messages[1]["type"] == "action_executed"
            assert websocket.sent_messages[1]["action_id"] == "poison"
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

            assert websocket.sent_messages[0] == {
                    "response_id": None,
                    "reason": (
                        "Apply condition preset steps require an instanced sheet."
                    ),
                    "type": "error",
                    "request_id": "req-1",
                }
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

            assert websocket.sent_messages[0] == {
                    "response_id": None,
                    "reason": "Augmentation 'missing' does not exist.",
                    "type": "error",
                    "request_id": "req-1",
                }

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

            assert websocket.sent_messages[0] == {
                    "response_id": None,
                    "reason": "Condition preset 'missing' does not exist.",
                    "type": "error",
                    "request_id": "req-2",
                }
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
            assert websocket.sent_messages[0] == {
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
                }
            assert websocket.sent_messages[1]["type"] == "action_executed"
            assert websocket.sent_messages[1]["action_id"] == "take_damage"
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
            assert websocket.sent_messages[1]["type"] == "action_executed"
            assert websocket.sent_messages[1]["action_id"] == "blocked_damage"
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
            assert websocket.sent_messages[1]["type"] == "action_executed"
            assert websocket.sent_messages[1]["action_id"] == "massive_damage"
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

            assert websocket.sent_messages[0] == {
                    "response_id": None,
                    "reason": "Resolve damage steps require an instanced sheet.",
                    "type": "error",
                    "request_id": "req-1",
                }
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
            assert websocket.sent_messages[0] == {
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
                }
            assert websocket.sent_messages[1]["type"] == "action_executed"
            assert websocket.sent_messages[1]["action_id"] == "take_damage"
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())
