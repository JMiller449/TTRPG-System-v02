import asyncio
from copy import deepcopy

from backend.features.chat import service as chat_service
from backend.routes.ws import handle_client_payload, websocket_sessions
from backend.state.models.action import Action
from backend.state.models.proficiency import ProficiencyBridge
from backend.state.models.sheet import InstancedSheet, Sheet
from backend.state.models.shared import Bridge
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


def _build_sheet_state() -> Sheet:
    return Sheet.from_dict(
        {
            "id": "mage_template",
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
                "lifting": _formula_payload(
                    "@strength * 2",
                    [{"name": "strength", "path": ["stats", "strength"]}],
                ),
                "carry_weight": _formula_payload(
                    "@strength * 3",
                    [{"name": "strength", "path": ["stats", "strength"]}],
                ),
                "acrobatics": _formula_payload(
                    "@dexterity",
                    [{"name": "dexterity", "path": ["stats", "dexterity"]}],
                ),
                "stamina": _formula_payload(
                    "@constitution",
                    [{"name": "constitution", "path": ["stats", "constitution"]}],
                ),
                "reaction_time": _formula_payload(
                    "@dexterity",
                    [{"name": "dexterity", "path": ["stats", "dexterity"]}],
                ),
                "health": _formula_payload(
                    "@constitution * 10",
                    [{"name": "constitution", "path": ["stats", "constitution"]}],
                ),
                "endurance": _formula_payload(
                    "@constitution * 2",
                    [{"name": "constitution", "path": ["stats", "constitution"]}],
                ),
                "pain_tolerance": _formula_payload(
                    "@will", [{"name": "will", "path": ["stats", "will"]}]
                ),
                "sight_distance": _formula_payload(
                    "@perception * 4",
                    [{"name": "perception", "path": ["stats", "perception"]}],
                ),
                "intuition": _formula_payload(
                    "@perception",
                    [{"name": "perception", "path": ["stats", "perception"]}],
                ),
                "registration": _formula_payload(
                    "@arcane", [{"name": "arcane", "path": ["stats", "arcane"]}]
                ),
                "mana": _formula_payload(
                    "@arcane * 8", [{"name": "arcane", "path": ["stats", "arcane"]}]
                ),
                "control": _formula_payload(
                    "@arcane", [{"name": "arcane", "path": ["stats", "arcane"]}]
                ),
                "sensitivity": _formula_payload(
                    "@arcane", [{"name": "arcane", "path": ["stats", "arcane"]}]
                ),
                "charisma": _formula_payload(
                    "@will", [{"name": "will", "path": ["stats", "will"]}]
                ),
                "mental_fortitude": _formula_payload(
                    "@will * 2", [{"name": "will", "path": ["stats", "will"]}]
                ),
                "courage": _formula_payload(
                    "@will", [{"name": "will", "path": ["stats", "will"]}]
                ),
            },
            "slayed_record": {},
            "actions": {
                "primary": {
                    "relationship_id": "bridge-1",
                    "entry_id": "battle_cry",
                }
            },
        }
    )


def _build_instance_state() -> InstancedSheet:
    return InstancedSheet.from_dict(
        {
            "parent_id": "mage_template",
            "health": 90,
            "mana": 30,
            "augments": {},
        }
    )


def test_perform_action_executes_steps_and_returns_snapshot(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            StateSingleton.getState().sheets["mage_template"] = _build_sheet_state()
            StateSingleton.getState().actions["battle_cry"] = Action.from_dict(
                {
                    "id": "battle_cry",
                    "name": "Battle Cry",
                    "notes": "Lower strength, then announce it.",
                    "steps": [
                        {
                            "step_id": "step-1",
                            "type": "set_value",
                            "target": "caster",
                            "path": ["stats", "strength"],
                            "value": _formula_payload(
                                "@strength - 2",
                                [{"name": "strength", "path": ["stats", "strength"]}],
                            ),
                        },
                        {
                            "step_id": "step-2",
                            "type": "send_message",
                            "message": _formula_payload(
                                "Strength now @strength",
                                [{"name": "strength", "path": ["stats", "strength"]}],
                            ),
                        },
                    ],
                }
            )
            await websocket_sessions.reset()
            await chat_service.roll20_chat_bridge.reset()
            websocket = FakeWebSocket()
            bridge_socket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="player")
            await chat_service.roll20_chat_bridge.connect(bridge_socket)

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_template",
                    "action_id": "battle_cry",
                    "request_id": "req-4",
                },
            )

            assert StateSingleton.getState().sheets["mage_template"].stats.strength == 8
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "set",
                            "path": "/sheets/mage_template/stats/strength",
                            "value": 8,
                        }
                    ],
                    "state_version": 1,
                    "type": "state_patch",
                    "request_id": "req-1",
                },
                {
                    "response_id": None,
                    "sheet_id": "mage_template",
                    "action_id": "battle_cry",
                    "applied_mutations": ["stats.strength=8"],
                    "emitted_messages": ["Strength now (8)"],
                    "type": "action_executed",
                    "request_id": "req-1",
                },
            ]
            assert bridge_socket.sent_messages == [
                {
                    "message_id": bridge_socket.sent_messages[0]["message_id"],
                    "message": "Strength now (8)",
                    "type": "chat_message",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_perform_action_can_increment_and_decrement_instance_values(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.sheets["mage_template"].actions["spell"] = Bridge.from_dict(
                {
                    "relationship_id": "bridge-2",
                    "entry_id": "cast_spell",
                }
            )
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.actions["cast_spell"] = Action.from_dict(
                {
                    "id": "cast_spell",
                    "name": "Cast Spell",
                    "notes": "Spend mana and heal.",
                    "steps": [
                        {
                            "step_id": "step-1",
                            "type": "decrement_value",
                            "target": "caster",
                            "path": ["mana"],
                            "amount": _formula_payload("7"),
                        },
                        {
                            "step_id": "step-2",
                            "type": "increment_value",
                            "target": "caster",
                            "path": ["health"],
                            "amount": _formula_payload(
                                "@arcane / 2",
                                [{"name": "arcane", "path": ["stats", "arcane"]}],
                            ),
                        },
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="player")

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_instance",
                    "action_id": "cast_spell",
                },
            )

            assert state.instanced_sheets["mage_instance"].mana == 23
            assert state.instanced_sheets["mage_instance"].health == 97
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "inc",
                            "path": "/instanced_sheets/mage_instance/mana",
                            "value": -7,
                        },
                        {
                            "op": "inc",
                            "path": "/instanced_sheets/mage_instance/health",
                            "value": 7,
                        },
                    ],
                    "state_version": 1,
                    "type": "state_patch",
                    "request_id": "req-1",
                },
                {
                    "response_id": None,
                    "sheet_id": "mage_instance",
                    "action_id": "cast_spell",
                    "applied_mutations": ["mana-=7", "health+=7"],
                    "emitted_messages": [],
                    "type": "action_executed",
                    "request_id": "req-1",
                },
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_perform_action_rejects_incrementing_nonnumeric_instance_path(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.sheets["mage_template"].actions["bad"] = Bridge.from_dict(
                {
                    "relationship_id": "bridge-2",
                    "entry_id": "bad_action",
                }
            )
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.actions["bad_action"] = Action.from_dict(
                {
                    "id": "bad_action",
                    "name": "Bad Action",
                    "steps": [
                        {
                            "step_id": "step-1",
                            "type": "increment_value",
                            "target": "caster",
                            "path": ["parent_id"],
                            "amount": _formula_payload("1"),
                        },
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="player")

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_instance",
                    "action_id": "bad_action",
                },
            )

            assert state.instanced_sheets["mage_instance"].parent_id == "mage_template"
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "State path /instanced_sheets/mage_instance/parent_id is not numeric.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_perform_action_spends_instance_resource_and_gains_proficiency_use(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.sheets["mage_template"].actions["spell"] = Bridge.from_dict(
                {
                    "relationship_id": "bridge-2",
                    "entry_id": "focused_cast",
                }
            )
            state.sheets["mage_template"].proficiencies["magic"] = (
                ProficiencyBridge.from_dict(
                    {
                        "relationship_id": "prof-bridge-1",
                        "prof_id": "magic_prof",
                        "use_count": 2,
                        "growth_rate": 0.2,
                    }
                )
            )
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.actions["focused_cast"] = Action.from_dict(
                {
                    "id": "focused_cast",
                    "name": "Focused Cast",
                    "steps": [
                        {
                            "step_id": "step-1",
                            "type": "decrement_value",
                            "target": "caster",
                            "path": ["mana"],
                            "amount": _formula_payload("8"),
                            "min_value": _formula_payload("0"),
                            "on_min_violation": "reject",
                        },
                        {
                            "step_id": "step-2",
                            "type": "gain_proficiency_use",
                            "target": "caster",
                            "proficiency_id": "magic_prof",
                            "amount": _formula_payload("1"),
                        },
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="player")

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_instance",
                    "action_id": "focused_cast",
                },
            )

            assert state.instanced_sheets["mage_instance"].mana == 22
            assert state.sheets["mage_template"].proficiencies["magic"].use_count == 3
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "set",
                            "path": "/instanced_sheets/mage_instance/mana",
                            "value": 22,
                        },
                        {
                            "op": "inc",
                            "path": "/sheets/mage_template/proficiencies/magic/use_count",
                            "value": 1,
                        },
                    ],
                    "state_version": 1,
                    "type": "state_patch",
                    "request_id": "req-1",
                },
                {
                    "response_id": None,
                    "sheet_id": "mage_instance",
                    "action_id": "focused_cast",
                    "applied_mutations": [
                        "mana=22",
                        "proficiencies.magic.use_count+=1",
                    ],
                    "emitted_messages": [],
                    "type": "action_executed",
                    "request_id": "req-1",
                },
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_perform_action_rejects_resource_overspend_without_patch(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.sheets["mage_template"].actions["spell"] = Bridge.from_dict(
                {
                    "relationship_id": "bridge-2",
                    "entry_id": "overcast",
                }
            )
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.actions["overcast"] = Action.from_dict(
                {
                    "id": "overcast",
                    "name": "Overcast",
                    "steps": [
                        {
                            "step_id": "step-1",
                            "type": "decrement_value",
                            "target": "caster",
                            "path": ["mana"],
                            "amount": _formula_payload("40"),
                            "min_value": _formula_payload("0"),
                            "on_min_violation": "reject",
                        },
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="player")

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_instance",
                    "action_id": "overcast",
                },
            )

            assert state.instanced_sheets["mage_instance"].mana == 30
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "State path /instanced_sheets/mage_instance/mana would be below minimum 0.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_perform_action_applies_damage_to_instance_health(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.sheets["mage_template"].actions["damage"] = Bridge.from_dict(
                {
                    "relationship_id": "bridge-2",
                    "entry_id": "take_damage",
                }
            )
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.actions["take_damage"] = Action.from_dict(
                {
                    "id": "take_damage",
                    "name": "Take Damage",
                    "steps": [
                        {
                            "step_id": "step-1",
                            "type": "decrement_value",
                            "target": "caster",
                            "path": ["health"],
                            "amount": _formula_payload("15"),
                            "min_value": _formula_payload("0"),
                        },
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="player")

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_instance",
                    "action_id": "take_damage",
                },
            )

            assert state.instanced_sheets["mage_instance"].health == 75
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "set",
                            "path": "/instanced_sheets/mage_instance/health",
                            "value": 75,
                        },
                    ],
                    "state_version": 1,
                    "type": "state_patch",
                    "request_id": "req-1",
                },
                {
                    "response_id": None,
                    "sheet_id": "mage_instance",
                    "action_id": "take_damage",
                    "applied_mutations": ["health=75"],
                    "emitted_messages": [],
                    "type": "action_executed",
                    "request_id": "req-1",
                },
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_perform_action_clamps_damage_at_zero(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.sheets["mage_template"].actions["damage"] = Bridge.from_dict(
                {
                    "relationship_id": "bridge-2",
                    "entry_id": "massive_damage",
                }
            )
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.actions["massive_damage"] = Action.from_dict(
                {
                    "id": "massive_damage",
                    "name": "Massive Damage",
                    "steps": [
                        {
                            "step_id": "step-1",
                            "type": "decrement_value",
                            "target": "caster",
                            "path": ["health"],
                            "amount": _formula_payload("200"),
                            "min_value": _formula_payload("0"),
                        },
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="player")

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_instance",
                    "action_id": "massive_damage",
                },
            )

            assert state.instanced_sheets["mage_instance"].health == 0
            assert websocket.sent_messages[0]["ops"] == [
                {
                    "op": "set",
                    "path": "/instanced_sheets/mage_instance/health",
                    "value": 0,
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_perform_action_applies_healing_to_instance_health_with_max_clamp(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.sheets["mage_template"].actions["heal"] = Bridge.from_dict(
                {
                    "relationship_id": "bridge-2",
                    "entry_id": "heal_wounds",
                }
            )
            state.instanced_sheets["mage_instance"] = _build_instance_state()
            state.instanced_sheets["mage_instance"].health = 115
            state.actions["heal_wounds"] = Action.from_dict(
                {
                    "id": "heal_wounds",
                    "name": "Heal Wounds",
                    "steps": [
                        {
                            "step_id": "step-1",
                            "type": "increment_value",
                            "target": "caster",
                            "path": ["health"],
                            "amount": _formula_payload("20"),
                            "max_value": _formula_payload(
                                "@max_health",
                                [{"name": "max_health", "path": ["stats", "health"]}],
                            ),
                        },
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="player")

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_instance",
                    "action_id": "heal_wounds",
                },
            )

            assert state.instanced_sheets["mage_instance"].health == 120
            assert websocket.sent_messages[0]["ops"] == [
                {
                    "op": "set",
                    "path": "/instanced_sheets/mage_instance/health",
                    "value": 120,
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_perform_action_can_apply_bounded_decrement_against_base_sheet(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            state.sheets["mage_template"].actions["damage"] = Bridge.from_dict(
                {
                    "relationship_id": "bridge-2",
                    "entry_id": "take_damage",
                }
            )
            state.actions["take_damage"] = Action.from_dict(
                {
                    "id": "take_damage",
                    "name": "Take Damage",
                    "steps": [
                        {
                            "step_id": "step-1",
                            "type": "decrement_value",
                            "target": "caster",
                            "path": ["stats", "strength"],
                            "amount": _formula_payload("15"),
                            "min_value": _formula_payload("0"),
                        },
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="player")

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_template",
                    "action_id": "take_damage",
                },
            )

            assert state.sheets["mage_template"].stats.strength == 0
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "set",
                            "path": "/sheets/mage_template/stats/strength",
                            "value": 0,
                        },
                    ],
                    "state_version": 1,
                    "type": "state_patch",
                    "request_id": "req-1",
                },
                {
                    "response_id": None,
                    "sheet_id": "mage_template",
                    "action_id": "take_damage",
                    "applied_mutations": ["stats.strength=0"],
                    "emitted_messages": [],
                    "type": "action_executed",
                    "request_id": "req-1",
                },
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())
