import asyncio
from copy import deepcopy

from backend.features.state_sync.service import state_sync_service
from backend.routes.ws import handle_client_payload, websocket_sessions
from backend.state.models.item import Item
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


def _item_payload(item_id: str = "sword", name: str = "Sword") -> dict:
    return {
        "id": item_id,
        "name": name,
        "description": "A test item.",
        "world_anvil_url": "https://www.worldanvil.com/w/test/sword",
        "gm_notes": "Hidden lore.",
        "gm_special_properties": "Cursed under moonlight.",
        "price": "10g",
        "weight": "3",
        "augmentation_templates": [],
    }


def test_dm_can_create_item(monkeypatch) -> None:
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
                    "type": "create_item",
                    "item": _item_payload(),
                },
            )

            assert StateSingleton.getState().items["sword"].name == "Sword"
            assert websocket.sent_messages[0]["ops"][0]["op"] == "add"
            assert websocket.sent_messages[0]["ops"][0]["path"] == "/items/sword"
            assert websocket.sent_messages[0]["ops"][0]["value"]["id"] == "sword"
            assert websocket.sent_messages[0]["ops"][0]["value"][
                "world_anvil_url"
            ] == "https://www.worldanvil.com/w/test/sword"
            assert websocket.sent_messages[0]["ops"][0]["value"]["gm_notes"] == (
                "Hidden lore."
            )
            assert websocket.sent_messages[0]["ops"][0]["value"][
                "gm_special_properties"
            ] == "Cursed under moonlight."
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_item_from_dict_defaults_missing_optional_item_fields() -> None:
    raw = _item_payload()
    raw.pop("world_anvil_url")
    raw.pop("gm_notes")
    raw.pop("gm_special_properties")

    item = Item.from_dict(raw)

    assert item.world_anvil_url == ""
    assert item.gm_notes == ""
    assert item.gm_special_properties == ""


def test_player_item_patch_redacts_gm_only_fields(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await websocket_sessions.reset()
            dm_socket = FakeWebSocket()
            player_socket = FakeWebSocket()
            await websocket_sessions.connect(dm_socket, role="dm")
            await websocket_sessions.connect(player_socket, role="player")

            await handle_client_payload(
                dm_socket,
                {
                    "type": "create_item",
                    "item": _item_payload(),
                },
            )

            dm_value = dm_socket.sent_messages[0]["ops"][0]["value"]
            player_value = player_socket.sent_messages[0]["ops"][0]["value"]
            assert dm_value["gm_notes"] == "Hidden lore."
            assert dm_value["gm_special_properties"] == "Cursed under moonlight."
            assert "gm_notes" not in player_value
            assert "gm_special_properties" not in player_value
            assert player_socket.sent_messages[0]["state_version"] == (
                dm_socket.sent_messages[0]["state_version"]
            )
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_player_snapshot_redacts_gm_only_item_values(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            StateSingleton.getState().items["sword"] = Item.from_dict(_item_payload())

            dm_snapshot = await state_sync_service.snapshot(role="dm")
            player_snapshot = await state_sync_service.snapshot(role="player")

            assert dm_snapshot.state["items"]["sword"]["gm_notes"] == "Hidden lore."
            assert dm_snapshot.state["items"]["sword"]["gm_special_properties"] == (
                "Cursed under moonlight."
            )
            assert "gm_notes" not in player_snapshot.state["items"]["sword"]
            assert "gm_special_properties" not in player_snapshot.state["items"][
                "sword"
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_update_item(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.items["sword"] = Item.from_dict(_item_payload())
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "update_item",
                    "item_id": "sword",
                    "item": _item_payload(name="Renamed Sword"),
                },
            )

            assert state.items["sword"].name == "Renamed Sword"
            assert websocket.sent_messages[0]["ops"][0]["op"] == "set"
            assert websocket.sent_messages[0]["ops"][0]["path"] == "/items/sword"
            assert websocket.sent_messages[0]["ops"][0]["value"]["name"] == (
                "Renamed Sword"
            )
            assert websocket.sent_messages[0]["ops"][0]["value"][
                "world_anvil_url"
            ] == "https://www.worldanvil.com/w/test/sword"
            assert websocket.sent_messages[0]["ops"][0]["value"]["gm_notes"] == (
                "Hidden lore."
            )
            assert websocket.sent_messages[0]["ops"][0]["value"][
                "gm_special_properties"
            ] == "Cursed under moonlight."
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_delete_item(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.items["sword"] = Item.from_dict(_item_payload())
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "delete_item",
                    "item_id": "sword",
                },
            )

            assert "sword" not in state.items
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "remove",
                            "path": "/items/sword",
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


def test_player_cannot_create_item(monkeypatch) -> None:
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
                    "type": "create_item",
                    "item": _item_payload(),
                },
            )

            assert StateSingleton.getState().items == {}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Only a DM can edit equipment.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_create_item_rejects_duplicate_id(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.items["sword"] = Item.from_dict(_item_payload())
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "create_item",
                    "item": _item_payload(),
                },
            )

            assert list(state.items) == ["sword"]
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Item 'sword' already exists.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_update_item_rejects_missing_id(monkeypatch) -> None:
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
                    "type": "update_item",
                    "item_id": "missing",
                    "item": _item_payload(item_id="missing"),
                },
            )

            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Item 'missing' does not exist.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_update_item_rejects_id_change(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.items["sword"] = Item.from_dict(_item_payload())
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "update_item",
                    "item_id": "sword",
                    "item": _item_payload(item_id="other_item"),
                },
            )

            assert set(state.items) == {"sword"}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Item ID cannot be changed.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_delete_item_rejects_missing_id(monkeypatch) -> None:
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
                    "type": "delete_item",
                    "item_id": "missing",
                },
            )

            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Item 'missing' does not exist.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())
