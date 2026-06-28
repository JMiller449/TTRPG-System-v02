import asyncio
from copy import deepcopy

import pytest

from backend.features.sheet_admin.actions.schema import ActionDefinitionPayload
from backend.routes.ws import handle_client_payload, websocket_sessions
from backend.state.models.action import Action
from backend.state.models.proficiency import Proficiency
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


def _formula_payload(text: str, aliases: list[dict] | None = None) -> dict:
    return {
        "aliases": aliases,
        "text": text,
    }


def _action_payload(action_id: str = "battle_cry", name: str = "Battle Cry") -> dict:
    return {
        "id": action_id,
        "name": name,
        "notes": "A simple shout.",
        "steps": [
            {
                "step_id": "step-1",
                "type": "send_message",
                "message": _formula_payload("For glory"),
            }
        ],
    }


def _proficiency_payload(proficiency_id: str = "magic_prof") -> dict:
    return {
        "id": proficiency_id,
        "name": proficiency_id.replace("_", " ").title(),
        "description": "Test proficiency.",
    }


def test_dm_can_create_action(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "create_action",
                    "action": _action_payload(),
                },
            )

            assert StateSingleton.getState().actions["battle_cry"].name == "Battle Cry"
            assert websocket.sent_messages[0]["ops"][0]["op"] == "add"
            assert websocket.sent_messages[0]["ops"][0]["path"] == (
                "/actions/battle_cry"
            )
            assert websocket.sent_messages[0]["ops"][0]["value"]["id"] == "battle_cry"
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_create_action_with_gain_proficiency_step(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.proficiencies["magic_prof"] = Proficiency.from_dict(
                _proficiency_payload()
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            action = _action_payload()
            action["steps"] = [
                {
                    "step_id": "train-magic",
                    "type": "gain_proficiency_use",
                    "target": "caster",
                    "proficiency_id": "magic_prof",
                    "amount": _formula_payload("1"),
                }
            ]

            await handle_client_payload(
                websocket,
                {
                    "type": "create_action",
                    "action": action,
                },
            )

            step = state.actions["battle_cry"].steps[0]
            assert step.type == "gain_proficiency_use"
            assert step.proficiency_id == "magic_prof"
            assert step.amount.text == "1"
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_create_action_rejects_missing_gain_proficiency_reference(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            action = _action_payload()
            action["steps"] = [
                {
                    "step_id": "train-missing",
                    "type": "gain_proficiency_use",
                    "target": "caster",
                    "proficiency_id": "missing_prof",
                    "amount": _formula_payload("1"),
                }
            ]

            await handle_client_payload(
                websocket,
                {
                    "type": "create_action",
                    "action": action,
                },
            )

            assert StateSingleton.getState().actions == {}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Proficiency 'missing_prof' does not exist.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_update_action_rejects_missing_gain_proficiency_reference(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.actions["battle_cry"] = Action.from_dict(_action_payload())
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            action = _action_payload()
            action["steps"] = [
                {
                    "step_id": "train-missing",
                    "type": "gain_proficiency_use",
                    "target": "caster",
                    "proficiency_id": "missing_prof",
                    "amount": _formula_payload("1"),
                }
            ]

            await handle_client_payload(
                websocket,
                {
                    "type": "update_action",
                    "action_id": "battle_cry",
                    "action": action,
                },
            )

            assert state.actions["battle_cry"].steps[0].type == "send_message"
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Proficiency 'missing_prof' does not exist.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_create_action_with_augmentation_and_condition_steps(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            action = _action_payload()
            action["steps"] = [
                {
                    "step_id": "apply-augment",
                    "type": "apply_augmentation",
                    "target": "caster",
                    "augmentation_id": "shielded",
                    "operation": "apply",
                },
                {
                    "step_id": "remove-condition",
                    "type": "apply_condition_preset",
                    "target": "caster",
                    "condition_id": "poisoned",
                    "operation": "remove",
                },
            ]

            await handle_client_payload(
                websocket,
                {
                    "type": "create_action",
                    "action": action,
                },
            )

            steps = StateSingleton.getState().actions["battle_cry"].steps
            assert steps[0].type == "apply_augmentation"
            assert steps[0].augmentation_id == "shielded"
            assert steps[1].type == "apply_condition_preset"
            assert steps[1].condition_id == "poisoned"
            assert steps[1].operation == "remove"
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_create_action_with_resolve_damage_step(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            action = _action_payload()
            action["steps"] = [
                {
                    "step_id": "fire-damage",
                    "type": "resolve_damage",
                    "target": "caster",
                    "damage_type": "Fire",
                    "amount": _formula_payload("12"),
                }
            ]

            await handle_client_payload(
                websocket,
                {
                    "type": "create_action",
                    "action": action,
                },
            )

            step = StateSingleton.getState().actions["battle_cry"].steps[0]
            assert step.type == "resolve_damage"
            assert step.damage_type == "Fire"
            assert step.amount.text == "12"
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_create_action_with_calculated_value_reuse(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")
            action = _action_payload()
            action["steps"] = [
                {
                    "step_id": "calculate-healing",
                    "type": "calculate_value",
                    "variable_id": "healing_amount",
                    "value": _formula_payload("1d8 + 2"),
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
                        "Restored @healing HP.",
                        [
                            {
                                "name": "healing",
                                "path": ["action_values", "healing_amount"],
                            }
                        ],
                    ),
                },
            ]

            await handle_client_payload(
                websocket,
                {"type": "create_action", "action": action},
            )

            steps = StateSingleton.getState().actions["battle_cry"].steps
            assert steps[0].type == "calculate_value"
            assert steps[0].variable_id == "healing_amount"
            assert steps[1].amount.type == "calculated_value"
            assert steps[1].amount.variable_id == "healing_amount"
            assert steps[2].message.aliases[0].path == [
                "action_values",
                "healing_amount",
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_action_authoring_rejects_forward_calculated_value_reference() -> None:
    action = _action_payload()
    action["steps"] = [
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
            "step_id": "calculate-healing",
            "type": "calculate_value",
            "variable_id": "healing_amount",
            "value": _formula_payload("5"),
        },
    ]

    with pytest.raises(ValueError, match="must refer to an earlier calculate_value step"):
        ActionDefinitionPayload.model_validate(action)


def test_action_authoring_rejects_duplicate_calculated_variable_id() -> None:
    action = _action_payload()
    action["steps"] = [
        {
            "step_id": "calculate-one",
            "type": "calculate_value",
            "variable_id": "healing_amount",
            "value": _formula_payload("5"),
        },
        {
            "step_id": "calculate-two",
            "type": "calculate_value",
            "variable_id": "healing_amount",
            "value": _formula_payload("6"),
        },
    ]

    with pytest.raises(ValueError, match="variable IDs must be unique"):
        ActionDefinitionPayload.model_validate(action)


def test_dm_can_update_action(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.actions["battle_cry"] = Action.from_dict(_action_payload())
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "update_action",
                    "action_id": "battle_cry",
                    "action": _action_payload(name="Renamed Cry"),
                },
            )

            assert state.actions["battle_cry"].name == "Renamed Cry"
            assert websocket.sent_messages[0]["ops"][0]["op"] == "set"
            assert websocket.sent_messages[0]["ops"][0]["path"] == (
                "/actions/battle_cry"
            )
            assert websocket.sent_messages[0]["ops"][0]["value"]["name"] == (
                "Renamed Cry"
            )
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_delete_action(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.actions["battle_cry"] = Action.from_dict(_action_payload())
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "delete_action",
                    "action_id": "battle_cry",
                },
            )

            assert "battle_cry" not in state.actions
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "remove",
                            "path": "/actions/battle_cry",
                            "value": None,
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


def test_player_cannot_create_action(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="player")

            await handle_client_payload(
                websocket,
                {
                    "type": "create_action",
                    "action": _action_payload(),
                },
            )

            assert StateSingleton.getState().actions == {}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "This request requires an authenticated DM session.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_update_action_rejects_id_change(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.actions["battle_cry"] = Action.from_dict(_action_payload())
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "update_action",
                    "action_id": "battle_cry",
                    "action": _action_payload(action_id="other_action"),
                },
            )

            assert set(state.actions) == {"battle_cry"}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Action ID cannot be changed.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_create_action_rejects_unknown_mutation_path(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            action = _action_payload()
            action["steps"] = [
                {
                    "step_id": "bad-step",
                    "type": "increment_value",
                    "target": "caster",
                    "path": ["parent_id"],
                    "amount": _formula_payload("1"),
                }
            ]

            await handle_client_payload(
                websocket,
                {
                    "type": "create_action",
                    "action": action,
                },
            )

            assert StateSingleton.getState().actions == {}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Action mutation path 'parent_id' is not supported.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_create_action_rejects_target_step_authoring(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            action = _action_payload()
            action["steps"] = [
                {
                    "step_id": "bad-target",
                    "type": "decrement_value",
                    "target": "target",
                    "path": ["health"],
                    "amount": _formula_payload("1"),
                }
            ]

            await handle_client_payload(
                websocket,
                {
                    "type": "create_action",
                    "action": action,
                },
            )

            assert StateSingleton.getState().actions == {}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": (
                        "Action step target 'target' is not supported for MVP; "
                        "use 'caster'."
                    ),
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())
