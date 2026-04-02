import asyncio
from copy import deepcopy
from dataclasses import asdict

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


def _basic_stats_payload() -> dict:
    derived_stats = {
        "lifting": _formula_payload(
            "@strength * 2", [{"name": "strength", "path": ["strength"]}]
        ),
        "carry_weight": _formula_payload(
            "@strength * 3", [{"name": "strength", "path": ["strength"]}]
        ),
        "acrobatics": _formula_payload(
            "@dexterity", [{"name": "dexterity", "path": ["dexterity"]}]
        ),
        "stamina": _formula_payload(
            "@constitution", [{"name": "constitution", "path": ["constitution"]}]
        ),
        "reaction_time": _formula_payload(
            "@dexterity", [{"name": "dexterity", "path": ["dexterity"]}]
        ),
        "health": _formula_payload(
            "@constitution * 10", [{"name": "constitution", "path": ["constitution"]}]
        ),
        "endurance": _formula_payload(
            "@constitution * 2", [{"name": "constitution", "path": ["constitution"]}]
        ),
        "pain_tolerance": _formula_payload(
            "@will", [{"name": "will", "path": ["will"]}]
        ),
        "sight_distance": _formula_payload(
            "@perception * 4", [{"name": "perception", "path": ["perception"]}]
        ),
        "intuition": _formula_payload(
            "@perception", [{"name": "perception", "path": ["perception"]}]
        ),
        "registration": _formula_payload(
            "@arcane", [{"name": "arcane", "path": ["arcane"]}]
        ),
        "mana": _formula_payload(
            "@arcane * 8", [{"name": "arcane", "path": ["arcane"]}]
        ),
        "control": _formula_payload(
            "@arcane", [{"name": "arcane", "path": ["arcane"]}]
        ),
        "sensitivity": _formula_payload(
            "@arcane", [{"name": "arcane", "path": ["arcane"]}]
        ),
        "charisma": _formula_payload("@will", [{"name": "will", "path": ["will"]}]),
        "mental_fortitude": _formula_payload(
            "@will * 2", [{"name": "will", "path": ["will"]}]
        ),
        "courage": _formula_payload("@will", [{"name": "will", "path": ["will"]}]),
    }
    return {
        "strength": 10,
        "dexterity": 11,
        "constitution": 12,
        "perception": 13,
        "arcane": 14,
        "will": 15,
        **derived_stats,
    }


def test_dm_can_create_action_definition(monkeypatch) -> None:
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
                    "type": "create_entity",
                    "entity_kind": "action",
                    "request_id": "req-1",
                    "entity": {
                        "id": "mana_burst",
                        "name": "Mana Burst",
                        "notes": "Burn mana, then announce it.",
                        "steps": [
                            {
                                "step_id": "step-1",
                                "type": "set_value",
                                "target": "caster",
                                "path": ["mana"],
                                "value": {
                                    "text": "@mana - 5",
                                    "aliases": [
                                        {
                                            "name": "mana",
                                            "path": ["mana"],
                                        }
                                    ],
                                },
                            },
                            {
                                "step_id": "step-2",
                                "type": "send_message",
                                "message": {
                                    "text": "Mana now at @mana",
                                    "aliases": [
                                        {
                                            "name": "mana",
                                            "path": ["mana"],
                                        }
                                    ],
                                },
                            },
                        ],
                    },
                },
            )

            assert websocket.sent_messages[0] == {
                "response_id": None,
                "ops": [
                    {
                        "op": "add",
                        "path": "/actions/mana_burst",
                        "value": asdict(
                            StateSingleton.getState().actions["mana_burst"]
                        ),
                    }
                ],
                "state_version": 1,
                "type": "state_patch",
                "request_id": "req-1",
            }
            assert len(websocket.sent_messages) == 1
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_update_and_delete_action_definition(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            StateSingleton.getState().actions["mana_burst"] = Action.from_dict(
                {
                    "id": "mana_burst",
                    "name": "Mana Burst",
                    "notes": "Original notes",
                    "steps": [
                        {
                            "step_id": "step-1",
                            "type": "send_message",
                            "message": {
                                "aliases": None,
                                "text": "Original message",
                            },
                        }
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "update_entity",
                    "entity_kind": "action",
                    "entity_id": "mana_burst",
                    "request_id": "req-2",
                    "entity_partial": {
                        "notes": "Updated notes",
                        "steps": [
                            {
                                "step_id": "step-1",
                                "type": "send_message",
                                "message": {
                                    "aliases": None,
                                    "text": "Updated message",
                                },
                            }
                        ],
                    },
                },
            )
            await handle_client_payload(
                websocket,
                {
                    "type": "delete_entity",
                    "entity_kind": "action",
                    "entity_id": "mana_burst",
                    "request_id": "req-3",
                },
            )

            updated_action = {
                "id": "mana_burst",
                "name": "Mana Burst",
                "notes": "Updated notes",
                "steps": [
                    {
                        "step_id": "step-1",
                        "message": {
                            "aliases": None,
                            "text": "Updated message",
                        },
                        "type": "send_message",
                    }
                ],
            }
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "set",
                            "path": "/actions/mana_burst",
                            "value": updated_action,
                        }
                    ],
                    "state_version": 1,
                    "type": "state_patch",
                    "request_id": "req-1",
                },
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "remove",
                            "path": "/actions/mana_burst",
                            "value": None,
                        }
                    ],
                    "state_version": 2,
                    "type": "state_patch",
                    "request_id": "req-2",
                },
            ]
            assert StateSingleton.getState().actions == {}
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_non_dm_cannot_mutate_actions(monkeypatch) -> None:
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
                    "type": "create_entity",
                    "entity_kind": "action",
                    "request_id": "req-4",
                    "entity": {
                        "id": "forbidden",
                        "name": "Forbidden",
                        "steps": [],
                    },
                },
            )

            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Sheet admin mutations require an authenticated DM session.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
            assert StateSingleton.getState().actions == {}
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_crud_formula_definition(monkeypatch) -> None:
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
                    "type": "create_entity",
                    "entity_kind": "formula",
                    "request_id": "req-5",
                    "entity": {
                        "id": "mana_pool",
                        "formula": _formula_payload(
                            "@arcane * 8",
                            [{"name": "arcane", "path": ["arcane"]}],
                        ),
                    },
                },
            )
            await handle_client_payload(
                websocket,
                {
                    "type": "update_entity",
                    "entity_kind": "formula",
                    "entity_id": "mana_pool",
                    "request_id": "req-6",
                    "entity_partial": {
                        "formula": _formula_payload(
                            "@arcane * 10",
                            [{"name": "arcane", "path": ["arcane"]}],
                        ),
                    },
                },
            )
            await handle_client_payload(
                websocket,
                {
                    "type": "delete_entity",
                    "entity_kind": "formula",
                    "entity_id": "mana_pool",
                    "request_id": "req-7",
                },
            )

            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "add",
                            "path": "/formulas/mana_pool",
                            "value": {
                                "id": "mana_pool",
                                "formula": {
                                    "aliases": [
                                        {
                                            "name": "arcane",
                                            "path": ["arcane"],
                                        }
                                    ],
                                    "text": "@arcane * 8",
                                },
                            },
                        }
                    ],
                    "state_version": 1,
                    "type": "state_patch",
                    "request_id": "req-1",
                },
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "set",
                            "path": "/formulas/mana_pool",
                            "value": {
                                "id": "mana_pool",
                                "formula": {
                                    "aliases": [
                                        {
                                            "name": "arcane",
                                            "path": ["arcane"],
                                        }
                                    ],
                                    "text": "@arcane * 10",
                                },
                            },
                        }
                    ],
                    "state_version": 2,
                    "type": "state_patch",
                    "request_id": "req-2",
                },
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "remove",
                            "path": "/formulas/mana_pool",
                            "value": None,
                        }
                    ],
                    "state_version": 3,
                    "type": "state_patch",
                    "request_id": "req-3",
                },
            ]
            assert StateSingleton.getState().formulas == {}
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_crud_item_definition(monkeypatch) -> None:
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
                    "type": "create_entity",
                    "entity_kind": "item",
                    "request_id": "req-8",
                    "entity": {
                        "id": "focus_ring",
                        "name": "Focus Ring",
                        "description": "Improves mana.",
                        "price": "120g",
                        "weight": "1",
                        "stat_augmentations": [
                            {
                                "stat_name": "mana",
                                "augmentation": _formula_payload(
                                    "@arcane + 2",
                                    [{"name": "arcane", "path": ["arcane"]}],
                                ),
                            }
                        ],
                    },
                },
            )
            await handle_client_payload(
                websocket,
                {
                    "type": "update_entity",
                    "entity_kind": "item",
                    "entity_id": "focus_ring",
                    "request_id": "req-9",
                    "entity_partial": {
                        "name": "Greater Focus Ring",
                    },
                },
            )
            await handle_client_payload(
                websocket,
                {
                    "type": "delete_entity",
                    "entity_kind": "item",
                    "entity_id": "focus_ring",
                    "request_id": "req-10",
                },
            )

            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "add",
                            "path": "/items/focus_ring",
                            "value": {
                                "id": "focus_ring",
                                "name": "Focus Ring",
                                "description": "Improves mana.",
                                "price": "120g",
                                "weight": "1",
                                "stat_augmentations": [
                                    {
                                        "stat_name": "mana",
                                        "augmentation": {
                                            "aliases": [
                                                {
                                                    "name": "arcane",
                                                    "path": ["arcane"],
                                                }
                                            ],
                                            "text": "@arcane + 2",
                                        },
                                    }
                                ],
                            },
                        }
                    ],
                    "state_version": 1,
                    "type": "state_patch",
                    "request_id": "req-1",
                },
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "set",
                            "path": "/items/focus_ring",
                            "value": {
                                "id": "focus_ring",
                                "name": "Greater Focus Ring",
                                "description": "Improves mana.",
                                "price": "120g",
                                "weight": "1",
                                "stat_augmentations": [
                                    {
                                        "stat_name": "mana",
                                        "augmentation": {
                                            "aliases": [
                                                {
                                                    "name": "arcane",
                                                    "path": ["arcane"],
                                                }
                                            ],
                                            "text": "@arcane + 2",
                                        },
                                    }
                                ],
                            },
                        }
                    ],
                    "state_version": 2,
                    "type": "state_patch",
                    "request_id": "req-2",
                },
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "remove",
                            "path": "/items/focus_ring",
                            "value": None,
                        }
                    ],
                    "state_version": 3,
                    "type": "state_patch",
                    "request_id": "req-3",
                },
            ]
            assert StateSingleton.getState().items == {}
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_crud_sheet_definition(monkeypatch) -> None:
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
                    "type": "create_entity",
                    "entity_kind": "sheet",
                    "request_id": "req-11",
                    "entity": {
                        "id": "mage_template",
                        "name": "Mage Template",
                        "dm_only": False,
                        "xp_given_when_slayed": 25,
                        "xp_cap": "A",
                        "proficiencies": {},
                        "items": {},
                        "stats": _basic_stats_payload(),
                        "slayed_record": {},
                        "actions": {},
                    },
                },
            )
            await handle_client_payload(
                websocket,
                {
                    "type": "update_entity",
                    "entity_kind": "sheet",
                    "entity_id": "mage_template",
                    "request_id": "req-12",
                    "entity_partial": {
                        "name": "Archmage Template",
                    },
                },
            )
            await handle_client_payload(
                websocket,
                {
                    "type": "delete_entity",
                    "entity_kind": "sheet",
                    "entity_id": "mage_template",
                    "request_id": "req-13",
                },
            )

            assert websocket.sent_messages[0]["type"] == "state_patch"
            assert websocket.sent_messages[0]["ops"][0]["op"] == "add"
            assert (
                websocket.sent_messages[0]["ops"][0]["path"] == "/sheets/mage_template"
            )
            assert websocket.sent_messages[1]["type"] == "state_patch"
            assert websocket.sent_messages[1]["ops"][0]["op"] == "set"
            assert (
                websocket.sent_messages[1]["ops"][0]["value"]["name"]
                == "Archmage Template"
            )
            assert websocket.sent_messages[2]["type"] == "state_patch"
            assert websocket.sent_messages[2]["ops"][0] == {
                "op": "remove",
                "path": "/sheets/mage_template",
                "value": None,
            }
            assert StateSingleton.getState().sheets == {}
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())
