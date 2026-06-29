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
        "interaction_type": "equippable",
        "category": "Weapon",
        "rank": "F",
        "description": "A test item.",
        "price": "10g",
        "weight": "3",
        "augmentation_templates": [],
    }


def _bridge_payload(
    relationship_id: str = "main_hand",
    item_id: str = "sword",
    *,
    count: int = 1,
    equipped: bool = True,
) -> dict:
    return {
        "relationship_id": relationship_id,
        "count": count,
        "equipped": equipped,
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
            assert bridge.equipped is True
            assert websocket.sent_messages[0]["ops"][0] == {
                "op": "add",
                "path": "/sheets/mage_template/items/main_hand",
                "value": {
                    "relationship_id": "main_hand",
                    "count": 1,
                    "equipped": True,
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
                    "equipped": True,
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
                    "bridge": _bridge_payload(item_id="axe", count=2, equipped=False),
                },
            )

            bridge = state.sheets["mage_template"].items["main_hand"]
            assert bridge.item_id == "axe"
            assert bridge.count == 2
            assert bridge.equipped is False
            assert websocket.sent_messages[0]["ops"][0] == {
                "op": "set",
                "path": "/sheets/mage_template/items/main_hand",
                "value": {
                    "relationship_id": "main_hand",
                    "count": 2,
                    "equipped": False,
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
                    "equipped": True,
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
                    "equipped": True,
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
                    "equipped": True,
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


def test_equipped_bridge_requires_equippable_item_and_positive_quantity(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
            inventory_item = _item_payload("quest_key")
            inventory_item["interaction_type"] = "inventory_only"
            state.items["quest_key"] = Item.from_dict(inventory_item)
            state.items["sword"] = Item.from_dict(_item_payload())
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "create_sheet_item_bridge",
                    "sheet_id": "mage_template",
                    "bridge": _bridge_payload(item_id="quest_key", equipped=True),
                },
            )
            assert websocket.sent_messages[-1]["reason"] == "Item 'quest_key' is not equippable."

            await handle_client_payload(
                websocket,
                {
                    "type": "create_sheet_item_bridge",
                    "sheet_id": "mage_template",
                    "bridge": _bridge_payload(count=0, equipped=True),
                },
            )
            assert websocket.sent_messages[-1]["reason"] == (
                "An equipped item must have a positive quantity."
            )
            assert state.sheets["mage_template"].items == {}
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_sheet_allows_multiple_equipped_items(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
            state.items["sword"] = Item.from_dict(_item_payload())
            state.items["shield"] = Item.from_dict(_item_payload("shield"))
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            for relationship_id, item_id in (("sword", "sword"), ("shield", "shield")):
                await handle_client_payload(
                    websocket,
                    {
                        "type": "create_sheet_item_bridge",
                        "sheet_id": "mage_template",
                        "bridge": _bridge_payload(
                            relationship_id=relationship_id,
                            item_id=item_id,
                            equipped=True,
                        ),
                    },
                )

            assert all(
                bridge.equipped
                for bridge in state.sheets["mage_template"].items.values()
            )
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_item_update_and_delete_respect_attached_bridge_dependencies(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
            state.items["sword"] = Item.from_dict(_item_payload())
            state.sheets["mage_template"].items["sword"] = ItemBridge.from_dict(
                _bridge_payload(relationship_id="sword", equipped=True)
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            inventory_item = _item_payload()
            inventory_item["interaction_type"] = "inventory_only"
            await handle_client_payload(
                websocket,
                {
                    "type": "update_item",
                    "item_id": "sword",
                    "item": inventory_item,
                },
            )
            assert "cannot become inventory_only while equipped" in websocket.sent_messages[-1][
                "reason"
            ]

            await handle_client_payload(
                websocket,
                {"type": "delete_item", "item_id": "sword"},
            )
            assert websocket.sent_messages[-1]["reason"] == (
                "Item 'sword' cannot be deleted while attached to sheets: mage_template."
            )
            assert "sword" in state.items
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())
