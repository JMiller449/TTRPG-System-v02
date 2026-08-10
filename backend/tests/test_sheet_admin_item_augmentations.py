import asyncio
from copy import deepcopy

from backend.protocol.socket import normalize_server_event
from backend.routes.ws import handle_client_payload, websocket_sessions
from backend.state.models.item import Item
from backend.state.store import DEFAULT_STATE, StateSingleton


class FakeWebSocket:
    def __init__(self) -> None:
        self.sent_messages: list[dict] = []

    async def accept(self) -> None:
        return None

    async def send_json(self, payload: dict) -> None:
        self.sent_messages.append(payload)


def _reset_state() -> None:
    StateSingleton._state = deepcopy(DEFAULT_STATE)


def _item_payload(*, effect_ids: list[str] | None = None) -> dict:
    return {
        "id": "sword",
        "name": "Sword",
        "interaction_type": "equippable",
        "rank": "F",
        "description": "",
        "price": "",
        "weight": 1,
        "effect_ids": effect_ids or [],
        "action_grants": [],
        "attributes": {},
    }


def _effect_payload(*, effect_id: str = "sword-health-bonus") -> dict:
    return {
        "id": effect_id,
        "name": "Sword Health Bonus",
        "description": "",
        "scope": "instance",
        "target": {"root": "instance", "path": ["health"]},
        "effect": {
            "type": "formula_modifier",
            "operation": "add",
            "value": {"aliases": None, "text": "2", "tags": []},
            "selector": {},
        },
        "active": True,
        "lifecycle": {},
        "stacking": {"mode": "unique", "max_stacks": None},
    }


def _legacy_augmentation_payload() -> dict:
    effect = _effect_payload()
    return {
        "id": effect["id"],
        "name": effect["name"],
        "description": effect["description"],
        "source": {"type": "item", "id": "sword", "label": "Sword"},
        "scope": effect["scope"],
        "target": effect["target"],
        "effect": effect["effect"],
        "active": True,
        "applied": False,
        "applied_target_id": None,
        "lifecycle_owner": "equipment",
        "lifecycle": {},
    }


def test_item_round_trips_canonical_effect_references() -> None:
    item = Item.from_dict(_item_payload(effect_ids=["sword-health-bonus"]))
    assert item.effect_ids == ["sword-health-bonus"]


def test_state_snapshot_protocol_accepts_item_effect_references() -> None:
    normalized = normalize_server_event(
        {
            "response_id": None,
            "state": {
                "items": {"sword": _item_payload(effect_ids=["sword-health-bonus"])},
                "standalone_effects": {"sword-health-bonus": _effect_payload()},
            },
            "state_version": 3,
            "type": "state_snapshot",
            "request_id": "req-1",
        }
    )
    assert normalized["state"]["items"]["sword"]["effect_ids"] == [
        "sword-health-bonus"
    ]


def test_dm_can_create_item_with_existing_effect_reference(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            await websocket_sessions.reset()
            socket = FakeWebSocket()
            await websocket_sessions.connect(socket, role="dm")
            await handle_client_payload(
                socket,
                {"type": "create_standalone_effect", "effect": _effect_payload()},
            )
            await handle_client_payload(
                socket,
                {
                    "type": "create_item",
                    "item": _item_payload(effect_ids=["sword-health-bonus"]),
                },
            )
            assert state.items["sword"].effect_ids == ["sword-health-bonus"]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_legacy_upsert_route_centralizes_and_attaches_effect(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.items["sword"] = Item.from_dict(_item_payload())
            await websocket_sessions.reset()
            socket = FakeWebSocket()
            await websocket_sessions.connect(socket, role="dm")
            await handle_client_payload(
                socket,
                {
                    "type": "upsert_item_augmentation_template",
                    "item_id": "sword",
                    "augmentation": _legacy_augmentation_payload(),
                },
            )
            assert state.items["sword"].effect_ids == ["sword-health-bonus"]
            assert state.standalone_effects["sword-health-bonus"].effect.value.text == "2"

            await handle_client_payload(
                socket,
                {
                    "type": "remove_item_augmentation_template",
                    "item_id": "sword",
                    "augmentation_id": "sword-health-bonus",
                },
            )
            assert state.items["sword"].effect_ids == []
            assert "sword-health-bonus" in state.standalone_effects
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_item_rejects_missing_effect_reference(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await websocket_sessions.reset()
            socket = FakeWebSocket()
            await websocket_sessions.connect(socket, role="dm")
            await handle_client_payload(
                socket,
                {
                    "type": "create_item",
                    "item": _item_payload(effect_ids=["missing-effect"]),
                },
            )
            assert "sword" not in StateSingleton.getState().items
            assert socket.sent_messages[-1]["reason"] == "Effect 'missing-effect' does not exist."
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_player_cannot_use_legacy_item_effect_upsert(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            StateSingleton.getState().items["sword"] = Item.from_dict(_item_payload())
            await websocket_sessions.reset()
            socket = FakeWebSocket()
            await websocket_sessions.connect(socket, role="player")
            await handle_client_payload(
                socket,
                {
                    "type": "upsert_item_augmentation_template",
                    "item_id": "sword",
                    "augmentation": _legacy_augmentation_payload(),
                },
            )
            assert StateSingleton.getState().items["sword"].effect_ids == []
            assert socket.sent_messages[-1]["type"] == "error"
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())
