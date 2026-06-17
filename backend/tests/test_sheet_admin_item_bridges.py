import asyncio
from copy import deepcopy

from backend.routes.ws import handle_client_payload, websocket_sessions
from backend.state.models.item import Item, ItemBridge
from backend.state.models.sheet import Sheet
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


def _sheet_payload(sheet_id: str = "mage_template") -> dict:
    return {
        "id": sheet_id,
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
            "lifting": _formula_payload("@strength * 2"),
            "carry_weight": _formula_payload("@strength * 3"),
            "acrobatics": _formula_payload("@dexterity"),
            "stamina": _formula_payload("@constitution"),
            "reaction_time": _formula_payload("@dexterity"),
            "health": _formula_payload("@constitution * 10"),
            "endurance": _formula_payload("@constitution * 2"),
            "pain_tolerance": _formula_payload("@will"),
            "sight_distance": _formula_payload("@perception * 4"),
            "intuition": _formula_payload("@perception"),
            "registration": _formula_payload("@arcane"),
            "mana": _formula_payload("@arcane * 8"),
            "control": _formula_payload("@arcane"),
            "sensitivity": _formula_payload("@arcane"),
            "charisma": _formula_payload("@will"),
            "mental_fortitude": _formula_payload("@will * 2"),
            "courage": _formula_payload("@will"),
        },
        "slayed_record": {},
        "actions": {},
    }


def _item_payload(item_id: str = "sword") -> dict:
    return {
        "id": item_id,
        "name": "Sword",
        "description": "A test item.",
        "price": "10g",
        "weight": "3",
        "stat_augmentations": [],
        "augmentation_templates": [],
    }


def _bridge_payload(
    relationship_id: str = "main_hand",
    item_id: str = "sword",
    *,
    count: int = 1,
    active: bool = True,
) -> dict:
    return {
        "relationship_id": relationship_id,
        "count": count,
        "active": active,
        "item_id": item_id,
    }


def test_dm_can_create_sheet_item_bridge(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
            state.items["sword"] = Item.from_dict(_item_payload())
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "create_sheet_item_bridge",
                    "sheet_id": "mage_template",
                    "bridge": _bridge_payload(),
                },
            )

            bridge = state.sheets["mage_template"].items["main_hand"]
            assert bridge.relationship_id == "main_hand"
            assert bridge.item_id == "sword"
            assert bridge.count == 1
            assert bridge.active is True
            assert websocket.sent_messages[0]["ops"][0] == {
                "op": "add",
                "path": "/sheets/mage_template/items/main_hand",
                "value": {
                    "relationship_id": "main_hand",
                    "count": 1,
                    "active": True,
                    "item_id": "sword",
                },
            }
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_update_sheet_item_bridge(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
            state.sheets["mage_template"].items["main_hand"] = ItemBridge.from_dict(
                {
                    "relationship_id": "main_hand",
                    "count": 1,
                    "active": True,
                    "item_id": "sword",
                }
            )
            state.items["sword"] = Item.from_dict(_item_payload())
            state.items["axe"] = Item.from_dict(_item_payload("axe"))
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "update_sheet_item_bridge",
                    "sheet_id": "mage_template",
                    "relationship_id": "main_hand",
                    "bridge": _bridge_payload(item_id="axe", count=2, active=False),
                },
            )

            bridge = state.sheets["mage_template"].items["main_hand"]
            assert bridge.item_id == "axe"
            assert bridge.count == 2
            assert bridge.active is False
            assert websocket.sent_messages[0]["ops"][0] == {
                "op": "set",
                "path": "/sheets/mage_template/items/main_hand",
                "value": {
                    "relationship_id": "main_hand",
                    "count": 2,
                    "active": False,
                    "item_id": "axe",
                },
            }
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_delete_sheet_item_bridge(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
            state.sheets["mage_template"].items["main_hand"] = ItemBridge.from_dict(
                {
                    "relationship_id": "main_hand",
                    "count": 1,
                    "active": True,
                    "item_id": "sword",
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "delete_sheet_item_bridge",
                    "sheet_id": "mage_template",
                    "relationship_id": "main_hand",
                },
            )

            assert state.sheets["mage_template"].items == {}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "remove",
                            "path": "/sheets/mage_template/items/main_hand",
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


def test_player_cannot_create_sheet_item_bridge(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
            state.items["sword"] = Item.from_dict(_item_payload())
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="player")

            await handle_client_payload(
                websocket,
                {
                    "type": "create_sheet_item_bridge",
                    "sheet_id": "mage_template",
                    "bridge": _bridge_payload(),
                },
            )

            assert state.sheets["mage_template"].items == {}
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


def test_create_sheet_item_bridge_rejects_missing_sheet(monkeypatch) -> None:
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
                    "type": "create_sheet_item_bridge",
                    "sheet_id": "missing",
                    "bridge": _bridge_payload(),
                },
            )

            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Sheet 'missing' does not exist.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_create_sheet_item_bridge_rejects_missing_item(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "create_sheet_item_bridge",
                    "sheet_id": "mage_template",
                    "bridge": _bridge_payload(item_id="missing"),
                },
            )

            assert state.sheets["mage_template"].items == {}
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


def test_create_sheet_item_bridge_rejects_negative_count(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
            state.items["sword"] = Item.from_dict(_item_payload())
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "create_sheet_item_bridge",
                    "sheet_id": "mage_template",
                    "bridge": _bridge_payload(count=-1),
                },
            )

            assert state.sheets["mage_template"].items == {}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": (
                        "bridge.count: Input should be greater than or equal to 0"
                    ),
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_create_sheet_item_bridge_rejects_duplicate_relationship(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
            state.sheets["mage_template"].items["main_hand"] = ItemBridge.from_dict(
                {
                    "relationship_id": "main_hand",
                    "count": 1,
                    "active": True,
                    "item_id": "sword",
                }
            )
            state.items["sword"] = Item.from_dict(_item_payload())
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "create_sheet_item_bridge",
                    "sheet_id": "mage_template",
                    "bridge": _bridge_payload(),
                },
            )

            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Sheet item bridge 'main_hand' already exists.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_update_sheet_item_bridge_rejects_id_change(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
            state.sheets["mage_template"].items["main_hand"] = ItemBridge.from_dict(
                {
                    "relationship_id": "main_hand",
                    "count": 1,
                    "active": True,
                    "item_id": "sword",
                }
            )
            state.items["sword"] = Item.from_dict(_item_payload())
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "update_sheet_item_bridge",
                    "sheet_id": "mage_template",
                    "relationship_id": "main_hand",
                    "bridge": _bridge_payload(relationship_id="off_hand"),
                },
            )

            assert set(state.sheets["mage_template"].items) == {"main_hand"}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Sheet item bridge ID cannot be changed.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_delete_sheet_item_bridge_rejects_missing_relationship(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "delete_sheet_item_bridge",
                    "sheet_id": "mage_template",
                    "relationship_id": "missing",
                },
            )

            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Sheet item bridge 'missing' does not exist.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())
