import asyncio
from copy import deepcopy

from backend.routes.ws import handle_client_payload, websocket_sessions
from backend.state.models.item import Item
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


def _proficiency_payload(
    proficiency_id: str = "longsword",
    name: str = "Longsword",
    category: str = "custom",
) -> dict:
    return {
        "id": proficiency_id,
        "name": name,
        "description": "Tracks approved longsword use.",
        "category": category,
    }


def test_dm_can_create_proficiency(monkeypatch) -> None:
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
                    "type": "create_proficiency",
                    "proficiency": _proficiency_payload(),
                },
            )

            proficiency = StateSingleton.getState().proficiencies["longsword"]
            assert proficiency.name == "Longsword"
            assert websocket.sent_messages[0]["ops"][0] == {
                "op": "add",
                "path": "/proficiencies/longsword",
                "value": _proficiency_payload(),
            }
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_update_proficiency(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.proficiencies["longsword"] = Proficiency.from_dict(
                _proficiency_payload()
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "update_proficiency",
                    "proficiency_id": "longsword",
                    "proficiency": _proficiency_payload(name="Longsword Mastery"),
                },
            )

            assert state.proficiencies["longsword"].name == "Longsword Mastery"
            assert state.proficiencies["longsword"].category == "custom"
            assert websocket.sent_messages[0]["ops"][0] == {
                "op": "set",
                "path": "/proficiencies/longsword",
                "value": _proficiency_payload(name="Longsword Mastery"),
            }
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_delete_proficiency(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.proficiencies["longsword"] = Proficiency.from_dict(
                _proficiency_payload()
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "delete_proficiency",
                    "proficiency_id": "longsword",
                },
            )

            assert state.proficiencies == {}
            assert websocket.sent_messages[0]["ops"][0] == {
                "op": "remove",
                "path": "/proficiencies/longsword",
                "value": None,
            }
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_delete_proficiency_rejects_live_attribute_reference(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.proficiencies["longsword"] = Proficiency.from_dict(
                _proficiency_payload()
            )
            state.items["sword"] = Item.from_dict(
                {
                    "id": "sword",
                    "name": "Sword",
                    "interaction_type": "equippable",
                    "category": "Sword",
                    "rank": "D",
                    "description": "",
                    "price": "",
                    "weight": 0,
                    "augmentation_templates": [],
                    "attribute_profile": "weapon",
                    "attributes": {
                        "weapon_proficiency": {
                            "relationship_id": "required_attribute_weapon_proficiency",
                            "attribute_id": "weapon_proficiency",
                            "value": {"type": "reference", "value": "longsword"},
                            "evaluated_value": "longsword",
                        }
                    },
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {"type": "delete_proficiency", "proficiency_id": "longsword"},
            )

            assert "longsword" in state.proficiencies
            assert websocket.sent_messages[-1]["type"] == "error"
            assert "referenced by Attributes on: item 'sword'" in websocket.sent_messages[-1][
                "reason"
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_player_cannot_create_proficiency(monkeypatch) -> None:
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
                    "type": "create_proficiency",
                    "proficiency": _proficiency_payload(),
                },
            )

            assert StateSingleton.getState().proficiencies == {}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Only a DM can edit proficiencies.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_create_proficiency_rejects_duplicate_id(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.proficiencies["longsword"] = Proficiency.from_dict(
                _proficiency_payload()
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "create_proficiency",
                    "proficiency": _proficiency_payload(),
                },
            )

            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Proficiency 'longsword' already exists.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_update_proficiency_rejects_id_change(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.proficiencies["longsword"] = Proficiency.from_dict(
                _proficiency_payload()
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "update_proficiency",
                    "proficiency_id": "longsword",
                    "proficiency": _proficiency_payload(proficiency_id="axe"),
                },
            )

            assert set(state.proficiencies) == {"longsword"}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Proficiency ID cannot be changed.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_update_proficiency_rejects_missing_id(monkeypatch) -> None:
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
                    "type": "update_proficiency",
                    "proficiency_id": "longsword",
                    "proficiency": _proficiency_payload(),
                },
            )

            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Proficiency 'longsword' does not exist.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_delete_proficiency_rejects_missing_id(monkeypatch) -> None:
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
                    "type": "delete_proficiency",
                    "proficiency_id": "longsword",
                },
            )

            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Proficiency 'longsword' does not exist.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())
