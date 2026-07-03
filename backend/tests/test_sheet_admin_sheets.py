import asyncio
from copy import deepcopy

from backend.features.chat import service as chat_service
from backend.features.sheet_access import service as sheet_access_service
from backend.routes.ws import handle_client_payload, websocket_sessions
from backend.state.models.proficiency import Proficiency
from backend.state.models.encounter import EncounterPreset
from backend.state.models.sheet import InstancedSheet, Sheet
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


async def _connect_assigned_player(
    websocket: FakeWebSocket,
    *,
    sheet_id: str = "mage_template",
    instance_id: str = "mage_instance",
) -> None:
    await websocket_sessions.connect(websocket, role="player")
    await websocket_sessions.assign_player_sheet(
        websocket,
        sheet_id=sheet_id,
        instance_id=instance_id,
    )


def _formula_payload(text: str, aliases: list[dict] | None = None) -> dict:
    return {
        "aliases": aliases,
        "text": text,
    }


def _resistances_payload(**overrides: float) -> dict:
    payload = {
        "resistance": 0.0,
        "physical": 0.0,
        "magical": 0.0,
        "slashing": 0.0,
        "bludgeoning": 0.0,
        "piercing": 0.0,
        "arcane": 0.0,
        "fire": 0.0,
        "water": 0.0,
        "earth": 0.0,
        "wind": 0.0,
        "light": 0.0,
        "dark": 0.0,
        "lightning": 0.0,
        "ice": 0.0,
        "time": 0.0,
        "gravity": 0.0,
        "psychic": 0.0,
    }
    payload.update(overrides)
    return payload


def _sheet_payload(
    sheet_id: str = "mage_template",
    name: str = "Mage Template",
    notes: str = "",
) -> dict:
    return {
        "id": sheet_id,
        "name": name,
        "notes": notes,
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
        "resistances": _resistances_payload(),
        "slayed_record": {},
        "actions": {},
    }


def _proficiency_payload(proficiency_id: str = "magic_prof") -> dict:
    return {
        "id": proficiency_id,
        "name": proficiency_id.replace("_", " ").title(),
        "description": "Test proficiency.",
    }


def test_dm_can_create_sheet(monkeypatch) -> None:
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
                    "type": "create_sheet",
                    "sheet": _sheet_payload(notes="GM-only template notes."),
                },
            )

            sheet = StateSingleton.getState().sheets["mage_template"]
            assert sheet.name == "Mage Template"
            assert sheet.notes == "GM-only template notes."
            assert "baseline_check_strength" in StateSingleton.getState().actions
            assert "attack" not in StateSingleton.getState().actions
            assert "parry" not in StateSingleton.getState().actions
            assert "weapon_attack" in StateSingleton.getState().actions
            assert "weapon_damage" in StateSingleton.getState().actions
            assert (
                StateSingleton.getState().actions["baseline_check_strength"].roll_mode_kind
                == "check"
            )
            assert (
                StateSingleton.getState().actions["weapon_attack"].roll_mode_kind
                == "check"
            )
            assert StateSingleton.getState().actions["block"].steps[0].message.aliases[
                0
            ].path == ["sheet", "stats", "strength"]
            assert sheet.actions["default_baseline_check_strength"].entry_id == (
                "baseline_check_strength"
            )
            assert sheet.actions["default_dodge"].entry_id == "dodge"
            assert sheet.actions["default_block"].entry_id == "block"
            assert "default_attack" not in sheet.actions
            assert "default_parry" not in sheet.actions
            assert "default_weapon_attack" not in sheet.actions
            assert websocket.sent_messages[0]["ops"][-1]["op"] == "add"
            assert websocket.sent_messages[0]["ops"][-1]["path"] == (
                "/sheets/mage_template"
            )
            assert websocket.sent_messages[0]["ops"][-1]["value"]["id"] == (
                "mage_template"
            )
            assert {
                op["path"] for op in websocket.sent_messages[0]["ops"][:-1]
            } == {
                "/actions/baseline_check_strength",
                "/actions/baseline_check_dexterity",
                "/actions/baseline_check_constitution",
                "/actions/baseline_check_perception",
                "/actions/baseline_check_arcane",
                "/actions/baseline_check_will",
                "/actions/dodge",
                "/actions/block",
                "/actions/weapon_attack",
                "/actions/weapon_damage",
                "/actions/weapon_parry",
                "/actions/weapon_contest",
            }
            assert websocket.sent_messages[0]["type"] == "state_patch"
            assert websocket.sent_messages[0]["request_id"] == "req-1"
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_sheet_create_and_update_save_authored_facts_atomically(
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
            await handle_client_payload(
                websocket,
                {
                    "type": "create_fact",
                    "fact": {
                        "id": "combat_rating",
                        "name": "Combat Rating",
                        "subject_types": ["sheet"],
                        "value_type": "number",
                        "default_value": {
                            "type": "formula",
                            "formula": {
                                "aliases": [
                                    {
                                        "name": "strength",
                                        "path": ["stats", "strength"],
                                    },
                                    {
                                        "name": "dexterity",
                                        "path": ["stats", "dexterity"],
                                    },
                                ],
                                "text": "@strength + @dexterity",
                            },
                        },
                    },
                },
            )
            assert websocket.sent_messages[-1]["type"] == "state_patch"
            assert "combat_rating" in StateSingleton.getState().facts
            payload = _sheet_payload()
            payload["facts"] = {
                "combat_rating": {
                    "relationship_id": "sheet-fact-combat-rating",
                    "fact_id": "combat_rating",
                    "value": {
                        "type": "formula",
                        "formula": {
                            "aliases": [
                                {
                                    "name": "strength",
                                    "path": ["stats", "strength"],
                                },
                                {
                                    "name": "dexterity",
                                    "path": ["stats", "dexterity"],
                                },
                            ],
                            "text": "@strength + @dexterity",
                        },
                    },
                }
            }
            await handle_client_payload(
                websocket,
                {"type": "create_sheet", "sheet": payload},
            )

            sheet = StateSingleton.getState().sheets["mage_template"]
            assert sheet.facts["combat_rating"].evaluated_value == 21
            assert "amount_of_reactions" in sheet.facts
            assert websocket.sent_messages[-1]["type"] == "state_patch"
            created = websocket.sent_messages[-1]["ops"][-1]["value"]
            assert created["facts"]["combat_rating"]["evaluated_value"] == 21

            payload["name"] = "Updated Mage Template"
            payload["facts"]["combat_rating"]["value"] = {
                "type": "number",
                "value": 30,
            }
            await handle_client_payload(
                websocket,
                {
                    "type": "update_sheet",
                    "sheet_id": "mage_template",
                    "sheet": payload,
                },
            )
            updated = StateSingleton.getState().sheets["mage_template"]
            assert updated.name == "Updated Mage Template"
            assert updated.facts["combat_rating"].relationship_id == (
                "sheet-fact-combat-rating"
            )
            assert updated.facts["combat_rating"].evaluated_value == 30
            assert websocket.sent_messages[-1]["type"] == "state_patch"
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_sheet_create_rejects_cross_stat_fact_dependency_cycle(monkeypatch) -> None:
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
                    "type": "create_fact",
                    "fact": {
                        "id": "health_bonus",
                        "name": "Health Bonus",
                        "subject_types": ["sheet"],
                        "value_type": "number",
                        "default_value": {
                            "type": "formula",
                            "formula": {
                                "aliases": [
                                    {"name": "health", "path": ["stats", "health"]}
                                ],
                                "text": "@health",
                            },
                        },
                    },
                },
            )
            assert websocket.sent_messages[-1]["type"] == "state_patch"
            assert "health_bonus" in StateSingleton.getState().facts
            payload = _sheet_payload()
            payload["stats"]["health"] = _formula_payload(
                "@health_bonus",
                [{"name": "health_bonus", "path": ["facts", "health_bonus"]}],
            )
            payload["facts"] = {
                "health_bonus": {
                    "relationship_id": "sheet-fact-health-bonus",
                    "fact_id": "health_bonus",
                    "value": {
                        "type": "formula",
                        "formula": {
                            "aliases": [
                                {"name": "health", "path": ["stats", "health"]}
                            ],
                            "text": "@health",
                        },
                    },
                }
            }
            await handle_client_payload(
                websocket,
                {"type": "create_sheet", "sheet": payload},
            )

            assert websocket.sent_messages[-1]["type"] == "error"
            assert "dependency cycle" in websocket.sent_messages[-1]["reason"]
            assert "mage_template" not in StateSingleton.getState().sheets
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_set_sheet_notes(monkeypatch) -> None:
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
                    "type": "set_sheet_notes",
                    "sheet_id": "mage_template",
                    "notes": "Visible to the GM as backend template notes.",
                },
            )

            assert state.sheets["mage_template"].notes == (
                "Visible to the GM as backend template notes."
            )
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "set",
                            "path": "/sheets/mage_template/notes",
                            "value": "Visible to the GM as backend template notes.",
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


def test_player_cannot_set_sheet_notes(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)

            await handle_client_payload(
                websocket,
                {
                    "type": "set_sheet_notes",
                    "sheet_id": "mage_template",
                    "notes": "Player edit attempt.",
                },
            )

            assert state.sheets["mage_template"].notes == ""
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Only a DM can edit backend notes.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_set_sheet_notes_rejects_missing_sheet(monkeypatch) -> None:
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
                    "type": "set_sheet_notes",
                    "sheet_id": "missing",
                    "notes": "No sheet exists.",
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


def test_dm_can_set_sheet_slayed_count(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
            state.sheets["goblin_template"] = Sheet.from_dict(
                _sheet_payload(sheet_id="goblin_template", name="Goblin Template")
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "set_sheet_slayed_count",
                    "sheet_id": "mage_template",
                    "slayed_sheet_id": "goblin_template",
                    "count": 3,
                },
            )

            assert state.sheets["mage_template"].slayed_record[
                "goblin_template"
            ].count == 3
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "add",
                            "path": "/sheets/mage_template/slayed_record/goblin_template",
                            "value": {
                                "sheet_id": "goblin_template",
                                "count": 3,
                            },
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


def test_assigned_player_can_set_own_sheet_slayed_count(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
            state.sheets["goblin_template"] = Sheet.from_dict(
                _sheet_payload(sheet_id="goblin_template", name="Goblin Template")
            )
            state.instanced_sheets["mage_instance"] = InstancedSheet.from_dict(
                {
                    "parent_id": "mage_template",
                    "notes": "",
                    "health": 10,
                    "mana": 5,
                    "augments": {},
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)

            await handle_client_payload(
                websocket,
                {
                    "type": "set_sheet_slayed_count",
                    "sheet_id": "mage_template",
                    "slayed_sheet_id": "goblin_template",
                    "count": 1,
                },
            )

            assert state.sheets["mage_template"].slayed_record[
                "goblin_template"
            ].count == 1
            assert websocket.sent_messages[0]["type"] == "state_patch"
            assert websocket.sent_messages[0]["ops"][0]["path"] == (
                "/sheets/mage_template/slayed_record/goblin_template"
            )
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_player_cannot_set_other_sheet_slayed_count(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
            state.sheets["fighter_template"] = Sheet.from_dict(
                _sheet_payload(sheet_id="fighter_template", name="Fighter Template")
            )
            state.sheets["goblin_template"] = Sheet.from_dict(
                _sheet_payload(sheet_id="goblin_template", name="Goblin Template")
            )
            state.instanced_sheets["mage_instance"] = InstancedSheet.from_dict(
                {
                    "parent_id": "mage_template",
                    "notes": "",
                    "health": 10,
                    "mana": 5,
                    "augments": {},
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)

            await handle_client_payload(
                websocket,
                {
                    "type": "set_sheet_slayed_count",
                    "sheet_id": "fighter_template",
                    "slayed_sheet_id": "goblin_template",
                    "count": 1,
                },
            )

            assert state.sheets["fighter_template"].slayed_record == {}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "You can only edit your assigned sheet.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_default_baseline_check_executes_as_sheet_action(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await websocket_sessions.reset()
            await chat_service.roll20_chat_bridge.reset()
            websocket = FakeWebSocket()
            bridge_socket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")
            await chat_service.roll20_chat_bridge.connect(bridge_socket)

            await handle_client_payload(
                websocket,
                {
                    "type": "create_sheet",
                    "sheet": _sheet_payload(),
                },
            )
            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_template",
                    "action_id": "baseline_check_strength",
                },
            )

            assert websocket.sent_messages[-1] == {
                "response_id": None,
                "sheet_id": "mage_template",
                "action_id": "baseline_check_strength",
                "applied_mutations": [],
            "emitted_messages": ["Strength Check: /r (1d100 / 100) * (10)"],
                "type": "action_executed",
                "request_id": "req-2",
            }
            assert bridge_socket.sent_messages == [
                {
                    "message_id": bridge_socket.sent_messages[0]["message_id"],
                "message": "Strength Check: /r (1d100 / 100) * (10)",
                    "type": "chat_message",
                    "request_id": "req-2",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_default_dodge_and_block_presets_execute_as_sheet_actions(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await websocket_sessions.reset()
            await chat_service.roll20_chat_bridge.reset()
            websocket = FakeWebSocket()
            bridge_socket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")
            await chat_service.roll20_chat_bridge.connect(bridge_socket)

            await handle_client_payload(
                websocket,
                {
                    "type": "create_sheet",
                    "sheet": _sheet_payload(),
                },
            )
            for action_id in ("dodge", "block"):
                await handle_client_payload(
                    websocket,
                    {
                        "type": "perform_action",
                        "sheet_id": "mage_template",
                        "action_id": action_id,
                    },
                )

            assert websocket.sent_messages[-1] == {
                "response_id": None,
                "sheet_id": "mage_template",
                "action_id": "block",
                "applied_mutations": [],
                "emitted_messages": [
                    "Block: /r floor((10) * (1d100 / 100))"
                ],
                "type": "action_executed",
                "request_id": "req-3",
            }
            assert bridge_socket.sent_messages == [
                {
                    "message_id": bridge_socket.sent_messages[0]["message_id"],
                    "message": "Dodge: /r floor((11) * (1d100 / 100))",
                    "type": "chat_message",
                    "request_id": "req-2",
                },
                {
                    "message_id": bridge_socket.sent_messages[1]["message_id"],
                    "message": "Block: /r floor((10) * (1d100 / 100))",
                    "type": "chat_message",
                    "request_id": "req-3",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_update_sheet(monkeypatch) -> None:
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
                    "type": "update_sheet",
                    "sheet_id": "mage_template",
                    "sheet": _sheet_payload(name="Renamed Mage"),
                },
            )

            assert state.sheets["mage_template"].name == "Renamed Mage"
            assert websocket.sent_messages[0]["ops"] == [
                {
                    "op": "set",
                    "path": "/sheets/mage_template",
                    "value": websocket.sent_messages[0]["ops"][0]["value"],
                }
            ]
            assert websocket.sent_messages[0]["ops"][0]["value"]["name"] == (
                "Renamed Mage"
            )
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_delete_sheet(monkeypatch) -> None:
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
                    "type": "delete_sheet",
                    "sheet_id": "mage_template",
                },
            )

            assert "mage_template" not in state.sheets
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "remove",
                            "path": "/sheets/mage_template",
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


def test_delete_sheet_rejects_instance_and_encounter_dependencies(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
            state.instanced_sheets["mage_instance"] = InstancedSheet.from_dict(
                {
                    "parent_id": "mage_template",
                    "health": 100,
                    "mana": 20,
                    "augments": {},
                }
            )
            state.encounter_presets["mage_encounter"] = EncounterPreset.from_dict(
                {
                    "id": "mage_encounter",
                    "name": "Mage Encounter",
                    "entries": [{"template_id": "mage_template", "count": 1}],
                    "updated_at": "2026-06-28T00:00:00Z",
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {"type": "delete_sheet", "sheet_id": "mage_template"},
            )

            assert "mage_template" in state.sheets
            assert websocket.sent_messages[0]["reason"] == (
                "Sheet 'mage_template' cannot be deleted while referenced by "
                "instances: mage_instance; encounter presets: mage_encounter."
            )
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_create_instanced_sheet(monkeypatch) -> None:
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
                    "type": "create_instanced_sheet",
                    "instance_id": "mage_instance",
                    "parent_sheet_id": "mage_template",
                    "notes": "Instance table notes.",
                    "health": 100,
                    "mana": 20,
                },
            )

            instance = state.instanced_sheets["mage_instance"]
            assert instance.parent_id == "mage_template"
            assert instance.notes == "Instance table notes."
            assert instance.health == 100
            assert instance.mana == 20
            assert instance.resistances.fire == 0.0
            assert instance.augments == {}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "add",
                            "path": "/instanced_sheets/mage_instance",
                            "value": {
                                "parent_id": "mage_template",
                                "notes": "Instance table notes.",
                                "health": 100,
                                "mana": 20,
                                "resistances": _resistances_payload(),
                                "augments": {},
                            },
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


def test_player_can_set_instanced_sheet_notes(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
            state.instanced_sheets["mage_instance"] = InstancedSheet.from_dict(
                {
                    "parent_id": "mage_template",
                    "notes": "",
                    "health": 100,
                    "mana": 20,
                    "augments": {},
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)

            await handle_client_payload(
                websocket,
                {
                    "type": "set_instanced_sheet_notes",
                    "instance_id": "mage_instance",
                    "notes": "Player-authored instance notes.",
                },
            )

            assert state.instanced_sheets["mage_instance"].notes == (
                "Player-authored instance notes."
            )
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "set",
                            "path": "/instanced_sheets/mage_instance/notes",
                            "value": "Player-authored instance notes.",
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


def test_dm_can_set_instanced_sheet_notes(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
            state.instanced_sheets["mage_instance"] = InstancedSheet.from_dict(
                {
                    "parent_id": "mage_template",
                    "notes": "Player note.",
                    "health": 100,
                    "mana": 20,
                    "augments": {},
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "set_instanced_sheet_notes",
                    "instance_id": "mage_instance",
                    "notes": "DM correction.",
                },
            )

            assert state.instanced_sheets["mage_instance"].notes == "DM correction."
            assert websocket.sent_messages[0]["ops"] == [
                {
                    "op": "set",
                    "path": "/instanced_sheets/mage_instance/notes",
                    "value": "DM correction.",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_set_instanced_sheet_notes_rejects_missing_instance(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)

            await handle_client_payload(
                websocket,
                {
                    "type": "set_instanced_sheet_notes",
                    "instance_id": "missing",
                    "notes": "No instance exists.",
                },
            )

            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Instance 'missing' does not exist.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_player_can_set_instanced_sheet_health(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
            state.instanced_sheets["mage_instance"] = InstancedSheet.from_dict(
                {
                    "parent_id": "mage_template",
                    "notes": "",
                    "health": 100,
                    "mana": 20,
                    "augments": {},
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)

            await handle_client_payload(
                websocket,
                {
                    "type": "set_instanced_sheet_resource",
                    "instance_id": "mage_instance",
                    "resource": "health",
                    "value": 87.5,
                },
            )

            assert state.instanced_sheets["mage_instance"].health == 87.5
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "set",
                            "path": "/instanced_sheets/mage_instance/health",
                            "value": 87.5,
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


def test_dm_can_adjust_instanced_sheet_mana(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
            state.instanced_sheets["mage_instance"] = InstancedSheet.from_dict(
                {
                    "parent_id": "mage_template",
                    "notes": "",
                    "health": 100,
                    "mana": 20,
                    "augments": {},
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "adjust_instanced_sheet_resource",
                    "instance_id": "mage_instance",
                    "resource": "mana",
                    "delta": -7,
                },
            )

            assert state.instanced_sheets["mage_instance"].mana == 13
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "set",
                            "path": "/instanced_sheets/mage_instance/mana",
                            "value": 13,
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


def test_adjust_instanced_sheet_resource_rejects_below_zero(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
            state.instanced_sheets["mage_instance"] = InstancedSheet.from_dict(
                {
                    "parent_id": "mage_template",
                    "notes": "",
                    "health": 100,
                    "mana": 5,
                    "augments": {},
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)

            await handle_client_payload(
                websocket,
                {
                    "type": "adjust_instanced_sheet_resource",
                    "instance_id": "mage_instance",
                    "resource": "mana",
                    "delta": -6,
                },
            )

            assert state.instanced_sheets["mage_instance"].mana == 5
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Current resource value cannot be below zero.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_unauthenticated_client_cannot_adjust_instanced_sheet_resource(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
            state.instanced_sheets["mage_instance"] = InstancedSheet.from_dict(
                {
                    "parent_id": "mage_template",
                    "notes": "",
                    "health": 100,
                    "mana": 20,
                    "augments": {},
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()

            await handle_client_payload(
                websocket,
                {
                    "type": "adjust_instanced_sheet_resource",
                    "instance_id": "mage_instance",
                    "resource": "health",
                    "delta": -5,
                },
            )

            assert state.instanced_sheets["mage_instance"].health == 100
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Authenticate first to edit current resources.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_set_instanced_sheet_resource_rejects_fractional_mana(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
            state.instanced_sheets["mage_instance"] = InstancedSheet.from_dict(
                {
                    "parent_id": "mage_template",
                    "notes": "",
                    "health": 100,
                    "mana": 20,
                    "augments": {},
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)

            await handle_client_payload(
                websocket,
                {
                    "type": "set_instanced_sheet_resource",
                    "instance_id": "mage_instance",
                    "resource": "mana",
                    "value": 12.5,
                },
            )

            assert state.instanced_sheets["mage_instance"].mana == 20
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "value: Value error, Mana must be a whole number.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_create_instanced_sheet_with_resistances(monkeypatch) -> None:
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
                    "type": "create_instanced_sheet",
                    "instance_id": "mage_instance",
                    "parent_sheet_id": "mage_template",
                    "health": 100,
                    "mana": 20,
                    "resistances": _resistances_payload(
                        resistance=0.1,
                        magical=0.2,
                        fire=0.25,
                    ),
                },
            )

            instance = state.instanced_sheets["mage_instance"]
            assert instance.resistances.resistance == 0.1
            assert instance.resistances.magical == 0.2
            assert instance.resistances.fire == 0.25
            assert websocket.sent_messages[0]["ops"][0]["value"]["resistances"] == (
                _resistances_payload(
                    resistance=0.1,
                    magical=0.2,
                    fire=0.25,
                )
            )
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_create_instanced_sheet_with_access_code(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        monkeypatch.setattr(
            sheet_access_service, "_generate_access_code", lambda: "MAGE2026"
        )
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
                    "type": "create_instanced_sheet",
                    "instance_id": "mage_instance",
                    "parent_sheet_id": "mage_template",
                    "health": 100,
                    "mana": 20,
                    "generate_access_code": True,
                },
            )

            assert state.sheet_access_codes["MAGE2026"].sheet_id == "mage_template"
            assert state.sheet_access_codes["MAGE2026"].instance_id == "mage_instance"
            assert websocket.sent_messages[0]["type"] == "state_patch"
            assert websocket.sent_messages[0]["ops"][0]["path"] == (
                "/instanced_sheets/mage_instance"
            )
            assert websocket.sent_messages[1] == {
                "response_id": None,
                "codes": [
                    {
                        "code": "MAGE2026",
                        "sheet_id": "mage_template",
                        "instance_id": "mage_instance",
                        "active": True,
                    }
                ],
                "type": "sheet_access_codes",
                "request_id": "req-1",
            }
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_player_cannot_create_instanced_sheet(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)

            await handle_client_payload(
                websocket,
                {
                    "type": "create_instanced_sheet",
                    "instance_id": "mage_instance",
                    "parent_sheet_id": "mage_template",
                    "health": 100,
                    "mana": 20,
                },
            )

            assert state.instanced_sheets == {}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "This request requires an authenticated DM session.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_create_instanced_sheet_rejects_missing_parent_sheet(monkeypatch) -> None:
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
                    "type": "create_instanced_sheet",
                    "instance_id": "mage_instance",
                    "parent_sheet_id": "missing",
                    "health": 100,
                    "mana": 20,
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


def test_create_instanced_sheet_rejects_duplicate_instance(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
            state.instanced_sheets["mage_instance"] = InstancedSheet.from_dict(
                {
                    "parent_id": "mage_template",
                    "health": 100,
                    "mana": 20,
                    "augments": {},
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "create_instanced_sheet",
                    "instance_id": "mage_instance",
                    "parent_sheet_id": "mage_template",
                    "health": 100,
                    "mana": 20,
                },
            )

            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Instance 'mage_instance' already exists.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_player_cannot_create_sheet(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await _connect_assigned_player(websocket)

            await handle_client_payload(
                websocket,
                {
                    "type": "create_sheet",
                    "sheet": _sheet_payload(),
                },
            )

            assert StateSingleton.getState().sheets == {}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "This request requires an authenticated DM session.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_update_sheet_rejects_id_change(monkeypatch) -> None:
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
                    "type": "update_sheet",
                    "sheet_id": "mage_template",
                    "sheet": _sheet_payload(sheet_id="other_template"),
                },
            )

            assert set(state.sheets) == {"mage_template"}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Sheet ID cannot be changed.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_create_sheet_rejects_missing_embedded_action_reference(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            sheet = _sheet_payload()
            sheet["actions"] = {
                "bridge-1": {
                    "relationship_id": "bridge-1",
                    "entry_id": "missing_action",
                }
            }

            await handle_client_payload(
                websocket,
                {
                    "type": "create_sheet",
                    "sheet": sheet,
                },
            )

            assert StateSingleton.getState().sheets == {}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Action 'missing_action' does not exist.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_create_sheet_rejects_missing_embedded_item_reference(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            sheet = _sheet_payload()
            sheet["items"] = {
                "bridge-1": {
                    "relationship_id": "bridge-1",
                    "count": 1,
                    "equipped": True,
                    "item_id": "missing_item",
                }
            }

            await handle_client_payload(
                websocket,
                {
                    "type": "create_sheet",
                    "sheet": sheet,
                },
            )

            assert StateSingleton.getState().sheets == {}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Item 'missing_item' does not exist.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_create_sheet_rejects_missing_embedded_proficiency_reference(
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

            sheet = _sheet_payload()
            sheet["proficiencies"] = {
                "magic": {
                    "relationship_id": "magic",
                    "prof_id": "missing_prof",
                    "use_count": 0,
                    "growth_rate": 1.0,
                }
            }

            await handle_client_payload(
                websocket,
                {
                    "type": "create_sheet",
                    "sheet": sheet,
                },
            )

            assert StateSingleton.getState().sheets == {}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Proficiency 'missing_prof' does not exist.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_update_sheet_rejects_missing_embedded_proficiency_reference(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.proficiencies["magic_prof"] = Proficiency.from_dict(
                _proficiency_payload()
            )
            state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            sheet = _sheet_payload()
            sheet["proficiencies"] = {
                "magic": {
                    "relationship_id": "magic",
                    "prof_id": "missing_prof",
                    "use_count": 0,
                    "growth_rate": 1.0,
                }
            }

            await handle_client_payload(
                websocket,
                {
                    "type": "update_sheet",
                    "sheet_id": "mage_template",
                    "sheet": sheet,
                },
            )

            assert state.sheets["mage_template"].proficiencies == {}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Proficiency 'missing_prof' does not exist.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_create_sheet_rejects_missing_slayed_record_sheet(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            sheet = _sheet_payload()
            sheet["slayed_record"] = {
                "missing_sheet": {
                    "sheet_id": "missing_sheet",
                    "count": 1,
                }
            }

            await handle_client_payload(
                websocket,
                {
                    "type": "create_sheet",
                    "sheet": sheet,
                },
            )

            assert StateSingleton.getState().sheets == {}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Sheet 'missing_sheet' does not exist.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())
