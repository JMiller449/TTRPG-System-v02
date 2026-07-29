import asyncio
from copy import deepcopy

from backend.routes.ws import handle_client_payload, websocket_sessions
from backend.state.store import DEFAULT_STATE, StateSingleton


class FakeWebSocket:
    def __init__(self) -> None:
        self.sent_messages: list[dict] = []

    async def accept(self) -> None:
        return None

    async def send_json(self, payload: dict) -> None:
        self.sent_messages.append(payload)


def _item_payload(item_id: str, *, tags: list[str] | None = None) -> dict:
    return {
        "id": item_id,
        "name": "Tagged Sword",
        "interaction_type": "equippable",
        "rank": "D",
        "description": "",
        "world_anvil_url": "",
        "gm_notes": "",
        "gm_special_properties": "",
        "price": "",
        "weight": 3.0,
        "player_catalog_access": {"mode": "all", "instance_ids": []},
        "can_contain_items": False,
        "contents_weight_behavior": "normal",
        "tags": tags or [],
        "attributes": {},
        "augmentation_templates": [],
        "action_grants": [],
    }


def test_managed_tag_crud_preserves_references() -> None:
    async def scenario() -> None:
        original_state = StateSingleton._state
        try:
            StateSingleton._state = deepcopy(DEFAULT_STATE)
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "create_tag",
                    "tag": {
                        "id": "long_sword",
                        "name": "Long Sword",
                        "description": "A sword family.",
                    },
                },
            )
            assert StateSingleton.getState().tags["long_sword"].name == "Long Sword"

            await handle_client_payload(
                websocket,
                {
                    "type": "update_tag",
                    "tag_id": "long_sword",
                    "tag": {
                        "id": "long_sword",
                        "name": "Long Swords",
                        "description": "Managed classification only.",
                    },
                },
            )
            assert StateSingleton.getState().tags["long_sword"].name == "Long Swords"

            await handle_client_payload(
                websocket,
                {
                    "type": "create_item",
                    "item": _item_payload("tagged_sword", tags=["long_sword"]),
                },
            )
            await handle_client_payload(
                websocket,
                {"type": "delete_tag", "tag_id": "long_sword"},
            )
            assert websocket.sent_messages[-1]["type"] == "error"
            assert "cannot be deleted while it is referenced" in websocket.sent_messages[-1][
                "reason"
            ]

            await handle_client_payload(
                websocket,
                {"type": "delete_item", "item_id": "tagged_sword"},
            )
            await handle_client_payload(
                websocket,
                {"type": "delete_tag", "tag_id": "long_sword"},
            )
            assert websocket.sent_messages[-1]["type"] == "state_patch"
            assert "long_sword" not in StateSingleton.getState().tags
        finally:
            await websocket_sessions.reset()
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_item_template_crud_is_definition_only_and_forces_private_access() -> None:
    async def scenario() -> None:
        original_state = StateSingleton._state
        try:
            StateSingleton._state = deepcopy(DEFAULT_STATE)
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")
            template = _item_payload("sword_template", tags=["weapon"])

            await handle_client_payload(
                websocket,
                {"type": "create_item_template", "template": template},
            )
            state = StateSingleton.getState()
            assert state.items == {}
            assert state.item_templates["sword_template"].player_catalog_access.mode == "none"

            template["name"] = "Updated Sword Template"
            await handle_client_payload(
                websocket,
                {
                    "type": "update_item_template",
                    "template_id": "sword_template",
                    "template": template,
                },
            )
            assert state.item_templates["sword_template"].name == "Updated Sword Template"

            await handle_client_payload(
                websocket,
                {
                    "type": "delete_item_template",
                    "template_id": "sword_template",
                },
            )
            assert state.item_templates == {}
            assert websocket.sent_messages[-1]["type"] == "state_patch"
        finally:
            await websocket_sessions.reset()
            StateSingleton._state = original_state

    asyncio.run(scenario())
