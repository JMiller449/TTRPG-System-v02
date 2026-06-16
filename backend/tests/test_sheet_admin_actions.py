import asyncio
from copy import deepcopy

from backend.routes.ws import handle_client_payload, websocket_sessions
from backend.state.models.action import Action
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
