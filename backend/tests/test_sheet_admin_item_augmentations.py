import asyncio
from copy import deepcopy

from backend.protocol.socket import normalize_server_event
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


def _item_payload() -> dict:
    return {
        "id": "sword",
        "name": "Sword",
        "description": "A test sword.",
        "price": "10g",
        "weight": "3",
        "stat_augmentations": [],
        "augmentation_templates": [],
    }


def _augmentation_payload(
    *,
    augmentation_id: str = "sword-health-bonus",
    root: str = "instance",
    scope: str = "instance",
    value: str = "2",
) -> dict:
    return {
        "id": augmentation_id,
        "name": "Sword Health Bonus",
        "description": "Template applied by this item.",
        "source": {
            "type": "item",
            "id": "sword",
            "label": "Sword",
        },
        "scope": scope,
        "target": {
            "root": root,
            "path": ["health"],
        },
        "effect": {
            "type": "formula_modifier",
            "operation": "add",
            "value": {
                "aliases": None,
                "text": value,
            },
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


def test_item_round_trips_augmentation_templates() -> None:
    raw = _item_payload()
    raw["augmentation_templates"] = [_augmentation_payload()]

    item = Item.from_dict(raw)

    assert item.augmentation_templates[0].id == "sword-health-bonus"
    assert item.augmentation_templates[0].target.root == "instance"


def test_state_snapshot_protocol_accepts_item_augmentation_templates() -> None:
    raw = _item_payload()
    raw["augmentation_templates"] = [_augmentation_payload()]

    normalized = normalize_server_event(
        {
            "response_id": None,
            "state": {
                "sheets": {},
                "instanced_sheets": {},
                "formulas": {},
                "actions": {},
                "items": {
                    "sword": raw,
                },
                "proficiencies": {},
                "augmentations": {},
                "condition_presets": {},
            },
            "state_version": 3,
            "type": "state_snapshot",
            "request_id": "req-1",
        }
    )

    assert normalized["state"]["items"]["sword"]["augmentation_templates"][0][
        "id"
    ] == "sword-health-bonus"


def test_dm_can_upsert_update_and_remove_item_augmentation_template(
    monkeypatch,
) -> None:
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
                    "type": "upsert_item_augmentation_template",
                    "item_id": "sword",
                    "augmentation": _augmentation_payload(value="2"),
                    "request_id": "client-id-ignored",
                },
            )
            await handle_client_payload(
                websocket,
                {
                    "type": "upsert_item_augmentation_template",
                    "item_id": "sword",
                    "augmentation": _augmentation_payload(value="4"),
                },
            )
            await handle_client_payload(
                websocket,
                {
                    "type": "remove_item_augmentation_template",
                    "item_id": "sword",
                    "augmentation_id": "sword-health-bonus",
                },
            )

            assert state.items["sword"].augmentation_templates == []
            assert websocket.sent_messages[0]["ops"][0]["op"] == "add"
            assert websocket.sent_messages[0]["ops"][0]["path"] == (
                "/items/sword/augmentation_templates/-"
            )
            assert websocket.sent_messages[1]["ops"][0]["op"] == "set"
            assert websocket.sent_messages[1]["ops"][0]["path"] == (
                "/items/sword/augmentation_templates/0"
            )
            assert websocket.sent_messages[1]["ops"][0]["value"]["effect"]["value"][
                "text"
            ] == "4"
            assert websocket.sent_messages[2]["ops"][0] == {
                "op": "remove",
                "path": "/items/sword/augmentation_templates/0",
                "value": None,
            }
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_player_cannot_upsert_item_augmentation_template(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.items["sword"] = Item.from_dict(_item_payload())
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="player")

            await handle_client_payload(
                websocket,
                {
                    "type": "upsert_item_augmentation_template",
                    "item_id": "sword",
                    "augmentation": _augmentation_payload(),
                },
            )

            assert state.items["sword"].augmentation_templates == []
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


def test_item_augmentation_template_rejects_global_target(monkeypatch) -> None:
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
                    "type": "upsert_item_augmentation_template",
                    "item_id": "sword",
                    "augmentation": _augmentation_payload(root="state"),
                },
            )

            assert state.items["sword"].augmentation_templates == []
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Item augmentation templates cannot target global state.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_missing_item_augmentation_template_request_is_rejected(monkeypatch) -> None:
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
                    "type": "remove_item_augmentation_template",
                    "item_id": "missing",
                    "augmentation_id": "sword-health-bonus",
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
