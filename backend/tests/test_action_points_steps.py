import asyncio
import json
from copy import deepcopy
from collections.abc import Iterator
from pathlib import Path
from typing import Literal
from dataclasses import asdict

import pytest
from pydantic import ValidationError

from backend.features.chat import service as chat_service
from backend.features.sheet_admin.actions.schema import ActionDefinitionPayload
from backend.features.variable_registry.service import build_action_formula_authoring_metadata
from backend.protocol.state_schema import ActionPayload
from backend.routes.ws import handle_client_payload, websocket_sessions
from backend.state.models.action import Action, AdjustActionPointsStep
from backend.state.models.attribute import AttributeBridge, AttributeValue
from backend.state.models.shared import Bridge
from backend.state.models.state import State
from backend.state.store import DEFAULT_STATE, StateSingleton, _decode_checkpoint
from backend.tests.test_sheet_runtime import (
    FakeWebSocket,
    _build_instance_state,
    _build_sheet_state,
    _connect_assigned_player,
)


@pytest.fixture(autouse=True)
def action_point_state(monkeypatch: pytest.MonkeyPatch) -> Iterator[State]:
    state = deepcopy(DEFAULT_STATE)
    template = _build_sheet_state()
    template.actions = {"points": Bridge(relationship_id="points", entry_id="points")}
    state.sheets["mage_template"] = template
    instance = _build_instance_state(template)
    instance.reactions = 2
    instance.attributes["amount_of_reactions"] = AttributeBridge(
        relationship_id="limit", attribute_id="amount_of_reactions",
        value=AttributeValue(type="number", value=3), evaluated_value=3,
    )
    state.instanced_sheets["mage_instance"] = instance
    state.instanced_sheets["other_instance"] = deepcopy(instance)
    monkeypatch.setattr(StateSingleton, "_state", state)
    asyncio.run(websocket_sessions.reset())
    asyncio.run(chat_service.roll20_chat_bridge.reset())
    yield state
    asyncio.run(websocket_sessions.reset())
    asyncio.run(chat_service.roll20_chat_bridge.reset())


def points_step(
    operation: str = "consume", amount: int = 1, step_id: str = "points"
) -> dict:
    return {
        "step_id": step_id, "type": "adjust_action_points",
        "operation": operation, "amount": amount,
    }


def set_action(steps: list[dict], *, roll_mode_kind: str = "none") -> None:
    StateSingleton.getState().actions["points"] = Action.from_dict({
        "id": "points", "name": "Point action", "steps": steps,
        "roll_mode_kind": roll_mode_kind,
    })


async def perform(
    *,
    role: Literal["player", "dm"] = "player",
    sheet_id: str = "mage_instance",
    roll_mode: str = "normal",
) -> FakeWebSocket:
    client = FakeWebSocket()
    if role == "player":
        await _connect_assigned_player(client)
    else:
        await websocket_sessions.connect(client, role=role)
    await handle_client_payload(client, {
        "type": "perform_action", "request_id": "points-request",
        "sheet_id": sheet_id, "action_id": "points", "roll_mode": roll_mode,
    })
    return client


def errors(client: FakeWebSocket) -> list[dict]:
    return [message for message in client.sent_messages if message["type"] == "error"]


@pytest.mark.parametrize("operation,amount,expected", [("consume", 2, 0), ("restore", 1, 3)])
def test_action_points_authoring_execution_patches_and_checkpoint(
    operation: str, amount: int, expected: int, isolated_state_checkpoint: Path,
) -> None:
    async def scenario() -> None:
        dm = FakeWebSocket()
        await websocket_sessions.connect(dm, role="dm")
        await handle_client_payload(dm, {
            "type": "create_action", "request_id": "create-points",
            "action": {"id": "points", "name": "Point action", "steps": [points_step(operation, amount)]},
        })
        assert not errors(dm)
        action = StateSingleton.getState().actions["points"]
        assert isinstance(action.steps[0], AdjustActionPointsStep)
        public = ActionPayload.model_validate(asdict(action)).model_dump()
        assert public["steps"][0]["amount"] == amount
        assert Action.from_dict(public) == action

        client = await perform()
        assert not errors(client)
        state = StateSingleton.getState()
        assert state.instanced_sheets["mage_instance"].reactions == expected
        assert state.instanced_sheets["other_instance"].reactions == 2
        assert any(
            op == {"op": "set", "path": "/instanced_sheets/mage_instance/reactions", "value": expected}
            for message in client.sent_messages if message["type"] == "state_patch"
            for op in message["ops"]
        )
        assert sum(message["type"] == "action_executed" for message in client.sent_messages) == 1
        reloaded = _decode_checkpoint(json.loads(isolated_state_checkpoint.read_text()))
        assert reloaded.actions["points"].steps == action.steps
        assert reloaded.instanced_sheets["mage_instance"].reactions == expected

    asyncio.run(scenario())


@pytest.mark.parametrize("override", [
    {"amount": 0}, {"amount": -1}, {"amount": 0.5}, {"amount": True},
    {"amount": "2"}, {"operation": "reset"}, {"target": "target"},
])
def test_action_points_reject_invalid_authored_and_persisted_steps(override: dict) -> None:
    raw = {"id": "points", "name": "Points", "steps": [{**points_step(), **override}]}
    with pytest.raises(ValidationError):
        ActionDefinitionPayload.model_validate(raw)
    with pytest.raises(ValueError):
        Action.from_dict(raw)


def test_action_points_defaults_and_authoring_metadata() -> None:
    action = ActionDefinitionPayload.model_validate({
        "id": "points", "name": "Points",
        "steps": [{"type": "adjust_action_points", "step_id": "cost"}],
    })
    assert action.steps[0].amount == 1
    assert action.steps[0].operation == "consume"
    entry = next(step for step in build_action_formula_authoring_metadata().action_steps
                 if step.type == "adjust_action_points")
    assert entry.allowed_targets == ["caster"]
    assert entry.formula_fields == []


@pytest.mark.parametrize("operation,amount", [("consume", 2), ("restore", 3)])
def test_action_points_limit_failure_rolls_back_earlier_steps_before_chat(
    operation: str, amount: int
) -> None:
    async def scenario() -> None:
        set_action([
            points_step("consume", 1, "earlier-cost"),
            {"step_id": "message", "type": "send_message", "message": {"text": "Not delivered"}},
            points_step(operation, amount),
        ])
        bridge = FakeWebSocket()
        await chat_service.roll20_chat_bridge.connect(bridge, binding_key="instance:mage_instance")
        before = asdict(StateSingleton.getState())
        client = await perform()
        assert "action/reaction points" in errors(client)[0]["reason"]
        assert asdict(StateSingleton.getState()) == before
        assert not any(message["type"] == "chat_message" for message in bridge.sent_messages)
        assert not any(message["type"] == "state_patch" for message in client.sent_messages)
    asyncio.run(scenario())


@pytest.mark.parametrize("operation", ["consume", "restore"])
def test_action_points_delivery_failure_rolls_back(operation: str) -> None:
    class RejectingBridge(FakeWebSocket):
        async def send_json(self, payload: dict) -> None:
            self.sent_messages.append(payload)
            chat_service.roll20_chat_bridge.acknowledge_delivery(
                chat_service.Roll20ChatDelivery(
                    message_id=payload["message_id"], success=False,
                    reason="chat_input_failed", type="chat_delivery",
                ), websocket=self,
            )

    async def scenario() -> None:
        set_action([
            points_step(operation),
            {"step_id": "message", "type": "send_message", "message": {"text": "Test"}},
        ])
        await chat_service.roll20_chat_bridge.connect(RejectingBridge(), binding_key="instance:mage_instance")
        before = asdict(StateSingleton.getState())
        client = await perform()
        assert "delivery failed" in errors(client)[0]["reason"]
        assert asdict(StateSingleton.getState()) == before
        assert not any(message["type"] == "state_patch" for message in client.sent_messages)
    asyncio.run(scenario())


def test_advantage_consumes_once_and_sequential_steps_see_updated_balance() -> None:
    async def scenario() -> None:
        set_action([
            points_step("consume", 2, "spend"),
            points_step("restore", 1, "recover"),
            {"step_id": "roll", "type": "send_roll", "title": "Check", "rolls": [
                {"label": "Result", "value": {"text": "1d100"}},
            ]},
        ], roll_mode_kind="check")
        bridge = FakeWebSocket()
        await chat_service.roll20_chat_bridge.connect(bridge, binding_key="instance:mage_instance")
        client = await perform(roll_mode="advantage")
        assert not errors(client)
        assert StateSingleton.getState().instanced_sheets["mage_instance"].reactions == 1
        messages = [message for message in bridge.sent_messages if message["type"] == "chat_message"]
        assert len(messages) == 1
        assert "2d100kh1" in messages[0]["message"]
    asyncio.run(scenario())


@pytest.mark.parametrize("role,sheet_id,allowed", [
    ("player", "other_instance", False), ("dm", "mage_template", False),
    ("dm", "other_instance", True),
])
def test_action_point_steps_enforce_actor_and_instance_access(
    role: Literal["player", "dm"], sheet_id: str, allowed: bool
) -> None:
    set_action([points_step()])
    client = asyncio.run(perform(role=role, sheet_id=sheet_id))
    assert bool(errors(client)) is not allowed
    assert StateSingleton.getState().instanced_sheets["mage_instance"].reactions == 2
    assert StateSingleton.getState().instanced_sheets["other_instance"].reactions == (1 if allowed else 2)


def test_player_cannot_author_point_restoration() -> None:
    async def scenario() -> None:
        client = FakeWebSocket()
        await _connect_assigned_player(client)
        await handle_client_payload(client, {
            "type": "create_action",
            "action": {"id": "points", "name": "Free points", "steps": [points_step("restore")]},
        })
        assert errors(client)
        assert "points" not in StateSingleton.getState().actions
    asyncio.run(scenario())
