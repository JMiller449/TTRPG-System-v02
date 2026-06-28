import asyncio
from copy import deepcopy

import pytest

from backend.features.sheet_admin.shared.schema import UpdateEntity
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
        "augmentation_templates": [],
    }


def _augmentation_payload(
    *,
    augmentation_id: str = "sword-health-bonus",
    root: str = "instance",
    scope: str = "instance",
    path: list[str] | None = None,
    value: str = "2",
    selector: dict | None = None,
) -> dict:
    payload = {
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
            "path": ["health"] if path is None else path,
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
    if selector is not None:
        payload["effect"]["selector"] = selector
    return payload


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


def test_dm_upsert_normalizes_formula_modifier_selector(monkeypatch) -> None:
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
                    "augmentation": _augmentation_payload(
                        selector={
                            "required_tags": [" Damage ", "FIRE", "damage"],
                            "excluded_tags": [" Healing "],
                            "action_id": " action-1 ",
                            "formula_id": " formula-1 ",
                            "step_id": " step-1 ",
                        }
                    ),
                },
            )

            selector = state.items["sword"].augmentation_templates[0].effect.selector
            assert selector.required_tags == ["damage", "fire"]
            assert selector.excluded_tags == ["healing"]
            assert selector.action_id == "action-1"
            assert selector.formula_id == "formula-1"
            assert selector.step_id == "step-1"
            patch_selector = websocket.sent_messages[0]["ops"][0]["value"]["effect"][
                "selector"
            ]
            assert patch_selector == {
                "required_tags": ["damage", "fire"],
                "excluded_tags": ["healing"],
                "action_id": "action-1",
                "formula_id": "formula-1",
                "step_id": "step-1",
            }
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


@pytest.mark.parametrize(
    "effect",
    [
        {
            "type": "evaluation_formula_modifier",
            "operation": "add",
            "value": {"aliases": None, "text": "2", "tags": []},
            "selector": {"required_tags": ["damage"]},
        },
        {
            "type": "roll_mode_modifier",
            "roll_mode": "disadvantage",
            "selector": {"required_tags": ["check"]},
        },
    ],
)
def test_dm_can_upsert_evaluation_time_effect_variants(monkeypatch, effect: dict) -> None:
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
            augmentation = _augmentation_payload()
            augmentation["effect"] = effect

            await handle_client_payload(
                websocket,
                {
                    "type": "upsert_item_augmentation_template",
                    "item_id": "sword",
                    "augmentation": augmentation,
                },
            )

            stored = state.items["sword"].augmentation_templates[0].effect
            assert stored.type == effect["type"]
            assert websocket.sent_messages[0]["ops"][0]["value"]["effect"][
                "type"
            ] == effect["type"]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_upsert_rejects_conflicting_formula_modifier_selector_tags(
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
                    "augmentation": _augmentation_payload(
                        selector={
                            "required_tags": ["damage"],
                            "excluded_tags": ["DAMAGE"],
                        }
                    ),
                },
            )

            assert state.items["sword"].augmentation_templates == []
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": (
                        "augmentation.effect.formula_modifier.selector: Value error, "
                        "Formula modifier selector tags cannot be both required and "
                        "excluded: damage."
                    ),
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


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


def test_item_augmentation_template_accepts_sheet_catalog_target(monkeypatch) -> None:
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
                    "augmentation": _augmentation_payload(
                        root="sheet",
                        scope="sheet",
                        path=["stats", "strength"],
                    ),
                },
            )

            assert state.items["sword"].augmentation_templates[0].target.root == (
                "sheet"
            )
            assert state.items["sword"].augmentation_templates[0].target.path == [
                "stats",
                "strength",
            ]
            assert websocket.sent_messages[0]["ops"][0]["path"] == (
                "/items/sword/augmentation_templates/-"
            )
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_item_augmentation_template_accepts_resistance_catalog_target(
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
                    "augmentation": _augmentation_payload(
                        path=["resistances", "fire"],
                    ),
                },
            )

            assert state.items["sword"].augmentation_templates[0].target.path == [
                "resistances",
                "fire",
            ]
            assert websocket.sent_messages[0]["ops"][0]["op"] == "add"
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


def test_item_augmentation_template_rejects_uncataloged_path(monkeypatch) -> None:
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
                    "augmentation": _augmentation_payload(
                        root="sheet",
                        scope="sheet",
                        path=["items"],
                    ),
                },
            )

            assert state.items["sword"].augmentation_templates == []
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": (
                        "Item augmentation template target 'sheet.items' is not "
                        "allowed."
                    ),
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_item_augmentation_template_rejects_formula_backed_path(monkeypatch) -> None:
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
                    "augmentation": _augmentation_payload(
                        root="sheet",
                        scope="sheet",
                        path=["stats", "health"],
                    ),
                },
            )

            assert state.items["sword"].augmentation_templates == []
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": (
                        "Item augmentation template target 'sheet.stats.health' "
                        "is not allowed."
                    ),
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


def test_item_augmentation_template_rejects_scope_root_mismatch(monkeypatch) -> None:
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
                    "augmentation": _augmentation_payload(
                        root="sheet",
                        scope="instance",
                        path=["stats", "strength"],
                    ),
                },
            )

            assert state.items["sword"].augmentation_templates == []
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": (
                        "Item augmentation template scope must match its relative "
                        "target root."
                    ),
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_create_item_rejects_uncataloged_augmentation_template(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")
            payload = _item_payload()
            payload["augmentation_templates"] = [
                _augmentation_payload(path=["actions"]),
            ]

            await handle_client_payload(
                websocket,
                {
                    "type": "create_item",
                    "item": payload,
                },
            )

            assert StateSingleton.getState().items == {}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": (
                        "Item augmentation template target 'instance.actions' "
                        "is not allowed."
                    ),
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_update_item_rejects_uncataloged_augmentation_template(monkeypatch) -> None:
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
            payload = _item_payload()
            payload["augmentation_templates"] = [
                _augmentation_payload(path=["actions"]),
            ]

            await handle_client_payload(
                websocket,
                {
                    "type": "update_item",
                    "item_id": "sword",
                    "item": payload,
                },
            )

            assert state.items["sword"].augmentation_templates == []
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": (
                        "Item augmentation template target 'instance.actions' "
                        "is not allowed."
                    ),
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_shared_item_update_rejects_uncataloged_augmentation_template(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        from backend.features.sheet_admin.items import service as item_service

        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.items["sword"] = Item.from_dict(_item_payload())
            payload = _item_payload()
            payload["augmentation_templates"] = [
                _augmentation_payload(path=["actions"]),
            ]

            with pytest.raises(
                ValueError,
                match=(
                    "Item augmentation template target "
                    "'instance.actions' is not allowed."
                ),
            ):
                await item_service.update_item(
                    UpdateEntity(
                        type="update_entity",
                        entity_kind="item",
                        entity_id="sword",
                        entity_partial=payload,
                    )
                )

            assert state.items["sword"].augmentation_templates == []
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
