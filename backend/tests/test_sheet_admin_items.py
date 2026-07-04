import asyncio
from copy import deepcopy

import pytest
from pydantic import ValidationError

from backend.features.state_sync.service import state_sync_service
from backend.routes.ws import handle_client_payload, websocket_sessions
from backend.features.sheet_admin.items.schema import ItemDefinitionPayload
from backend.state.models.action import Action
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


def _item_payload(item_id: str = "sword", name: str = "Sword") -> dict:
    return {
        "id": item_id,
        "name": name,
        "interaction_type": "inventory_only",
        "category": "Weapon",
        "rank": "F",
        "description": "A test item.",
        "world_anvil_url": "https://www.worldanvil.com/w/test/sword",
        "gm_notes": "Hidden lore.",
        "gm_special_properties": "Cursed under moonlight.",
        "price": "10g",
        "weight": "3",
        "augmentation_templates": [],
    }


def _weapon_attribute_bridges(proficiency_id: str = "long_swords") -> dict:
    values = {
        "weapon_type": {"type": "text", "value": "Long Sword"},
        "weapon_base_damage": {"type": "number", "value": 15},
        "weapon_governing_stat": {"type": "enum", "value": "strength"},
        "weapon_damage_types": {"type": "list", "value": ["Slashing"]},
        "weapon_reach": {"type": "number", "value": 5},
        "weapon_proficiency": {"type": "reference", "value": proficiency_id},
        "weapon_proficiency_growth_rate": {"type": "number", "value": 0.8},
    }
    return {
        attribute_id: {
            "relationship_id": f"client-{attribute_id}",
            "attribute_id": attribute_id,
            "value": value,
        }
        for attribute_id, value in values.items()
    }


def _item_augmentation_payload(
    *,
    effect_type: str = "formula_modifier",
    value: dict | None = None,
) -> dict:
    return {
        "id": "attribute-powered-effect",
        "name": "Attribute Powered Effect",
        "description": "",
        "source": {"type": "item", "id": "sword", "label": "Sword"},
        "scope": "sheet",
        "target": {"root": "sheet", "path": ["stats", "strength"]},
        "effect": {
            "type": effect_type,
            "operation": "add",
            "value": value
            or {
                "text": "1",
                "aliases": None,
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


def test_item_augmentation_formula_can_reference_owning_item_attribute(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.proficiencies["long_swords"] = Proficiency(
                id="long_swords",
                name="Long Swords",
                description="",
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")
            payload = _item_payload()
            payload.update(
                {
                    "interaction_type": "equippable",
                    "attribute_profile": "weapon",
                    "attributes": _weapon_attribute_bridges(),
                    "augmentation_templates": [
                        _item_augmentation_payload(
                            value={
                                "text": "@base_damage",
                                "aliases": [
                                    {
                                        "name": "base_damage",
                                        "path": [
                                            "source_item",
                                            "attributes",
                                            "weapon_base_damage",
                                        ],
                                    }
                                ],
                            }
                        )
                    ],
                }
            )

            await handle_client_payload(
                websocket,
                {"type": "create_item", "item": payload},
            )

            assert state.items["sword"].augmentation_templates[0].effect.value.text == (
                "@base_damage"
            )
            assert websocket.sent_messages[0]["type"] == "state_patch"
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_item_augmentation_formula_rejects_missing_owning_item_attribute(
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
            payload = _item_payload()
            payload.update(
                {
                    "interaction_type": "equippable",
                    "augmentation_templates": [
                        _item_augmentation_payload(
                            value={
                                "text": "@base_damage",
                                "aliases": [
                                    {
                                        "name": "base_damage",
                                        "path": [
                                            "source_item",
                                            "attributes",
                                            "weapon_base_damage",
                                        ],
                                    }
                                ],
                            }
                        )
                    ],
                }
            )

            await handle_client_payload(
                websocket,
                {"type": "create_item", "item": payload},
            )

            assert "sword" not in StateSingleton.getState().items
            assert websocket.sent_messages[0]["reason"] == (
                "Formula alias 'base_damage' requires source-item profile 'weapon'."
            )
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_direct_item_augmentation_formula_rejects_action_context(
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
            payload = _item_payload()
            payload.update(
                {
                    "interaction_type": "equippable",
                    "augmentation_templates": [
                        _item_augmentation_payload(
                            value={
                                "text": "@mana_cost",
                                "aliases": [
                                    {
                                        "name": "mana_cost",
                                        "path": [
                                            "action",
                                            "attributes",
                                            "action_mana_cost",
                                        ],
                                    }
                                ],
                            }
                        )
                    ],
                }
            )

            await handle_client_payload(
                websocket,
                {"type": "create_item", "item": payload},
            )

            assert "sword" not in StateSingleton.getState().items
            assert websocket.sent_messages[0]["reason"] == (
                "Formula alias 'mana_cost' cannot use action context in a direct "
                "wearer effect."
            )
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_create_weapon_profile_with_backend_required_attributes(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.proficiencies["long_swords"] = Proficiency(
                id="long_swords",
                name="Long Swords",
                description="",
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")
            payload = _item_payload()
            payload.update(
                {
                    "interaction_type": "equippable",
                    "attribute_profile": "weapon",
                    "attributes": _weapon_attribute_bridges(),
                }
            )

            await handle_client_payload(
                websocket,
                {"type": "create_item", "item": payload},
            )

            weapon = state.items["sword"]
            assert weapon.attribute_profile == "weapon"
            assert set(weapon.attributes) == set(_weapon_attribute_bridges())
            assert weapon.attributes["weapon_base_damage"].evaluated_value == 15
            assert weapon.attributes["weapon_proficiency"].evaluated_value == "long_swords"
            assert all(
                bridge.relationship_id == f"required_attribute_{attribute_id}"
                for attribute_id, bridge in weapon.attributes.items()
            )
            assert state.attributes["weapon_base_damage"].required_profile == "weapon"

            await handle_client_payload(
                websocket,
                {
                    "type": "set_subject_attribute_value",
                    "subject_type": "item",
                    "subject_id": "sword",
                    "attribute_id": "weapon_base_damage",
                    "value": {"type": "number", "value": -1},
                },
            )
            assert websocket.sent_messages[-1]["type"] == "error"
            assert weapon.attributes["weapon_base_damage"].evaluated_value == 15

            await handle_client_payload(
                websocket,
                {
                    "type": "detach_subject_attribute",
                    "subject_type": "item",
                    "subject_id": "sword",
                    "attribute_id": "weapon_base_damage",
                },
            )
            assert websocket.sent_messages[-1]["type"] == "error"
            assert "Required Attributes cannot be detached" in websocket.sent_messages[-1]["reason"]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_weapon_profile_rejects_missing_proficiency_and_removes_attributes_on_clear(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")
            payload = _item_payload()
            payload.update(
                {
                    "interaction_type": "equippable",
                    "attribute_profile": "weapon",
                    "attributes": _weapon_attribute_bridges("missing"),
                }
            )

            await handle_client_payload(
                websocket,
                {"type": "create_item", "item": payload},
            )
            assert "sword" not in state.items
            assert "missing proficiency 'missing'" in websocket.sent_messages[-1]["reason"]

            state.proficiencies["long_swords"] = Proficiency(
                id="long_swords",
                name="Long Swords",
                description="",
            )
            payload["attributes"] = _weapon_attribute_bridges()
            await handle_client_payload(
                websocket,
                {"type": "create_item", "item": payload},
            )
            payload["attribute_profile"] = None
            await handle_client_payload(
                websocket,
                {"type": "update_item", "item_id": "sword", "item": payload},
            )
            assert state.items["sword"].attribute_profile is None
            assert state.items["sword"].attributes == {}
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
    assert item.action_grants == []


def test_item_interaction_type_rejects_invalid_cross_type_mechanics() -> None:
    inventory_item = _item_payload()
    inventory_item["action_grants"] = [
        {"action_id": "inspect", "availability": "carried"}
    ]
    with pytest.raises(ValidationError, match="Inventory-only items cannot grant actions"):
        ItemDefinitionPayload.model_validate(inventory_item)

    consumable = _item_payload("potion", "Potion")
    consumable["interaction_type"] = "consumable"
    with pytest.raises(ValidationError, match="require at least one carried action"):
        ItemDefinitionPayload.model_validate(consumable)

    consumable["action_grants"] = [
        {
            "action_id": "drink",
            "availability": "equipped",
            "consume_quantity": 1,
        }
    ]
    with pytest.raises(ValidationError, match="must use carried availability"):
        ItemDefinitionPayload.model_validate(consumable)


def test_dm_can_author_item_action_grants(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.actions["drink_potion"] = Action.from_dict(
                {"id": "drink_potion", "name": "Drink Potion", "steps": []}
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")
            payload = _item_payload("potion", "Potion")
            payload["interaction_type"] = "consumable"
            payload["action_grants"] = [
                {
                    "action_id": "drink_potion",
                    "availability": "carried",
                    "consume_quantity": 1,
                }
            ]

            await handle_client_payload(
                websocket,
                {"type": "create_item", "item": payload},
            )

            grant = state.items["potion"].action_grants[0]
            assert grant.action_id == "drink_potion"
            assert grant.availability == "carried"
            assert grant.consume_quantity == 1
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_item_action_grants_reject_unknown_and_duplicate_actions(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")
            payload = _item_payload("potion", "Potion")
            payload["interaction_type"] = "equippable"
            payload["action_grants"] = [
                {"action_id": "missing", "availability": "carried"},
                {"action_id": "missing", "availability": "equipped"},
            ]

            await handle_client_payload(
                websocket,
                {"type": "create_item", "item": payload},
            )

            assert "potion" not in StateSingleton.getState().items
            assert "unique action IDs" in websocket.sent_messages[0]["reason"]

            websocket.sent_messages.clear()
            payload["action_grants"] = [
                {"action_id": "missing", "availability": "carried"}
            ]
            await handle_client_payload(
                websocket,
                {"type": "create_item", "item": payload},
            )
            assert "potion" not in StateSingleton.getState().items
            assert websocket.sent_messages[0]["reason"] == (
                "Action 'missing' does not exist."
            )
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


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
