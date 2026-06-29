import asyncio
from copy import deepcopy

from backend.routes.ws import handle_client_payload, websocket_sessions
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


def _sheet_payload(sheet_id: str = "mage_template") -> dict:
    base_formula = _formula_payload("0")
    return {
        "id": sheet_id,
        "name": "Mage Template",
        "notes": "",
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
            "lifting": base_formula,
            "carry_weight": base_formula,
            "acrobatics": base_formula,
            "stamina": base_formula,
            "reaction_time": base_formula,
            "health": _formula_payload("120"),
            "endurance": base_formula,
            "pain_tolerance": base_formula,
            "sight_distance": base_formula,
            "intuition": base_formula,
            "registration": base_formula,
            "mana": _formula_payload("32"),
            "control": base_formula,
            "sensitivity": base_formula,
            "charisma": base_formula,
            "mental_fortitude": base_formula,
            "courage": base_formula,
        },
        "resistances": _resistances_payload(fire=10.0),
        "slayed_record": {},
        "actions": {},
    }


def test_dm_can_save_encounter_preset(monkeypatch) -> None:
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
                    "type": "save_encounter_preset",
                    "encounter": {
                        "id": "encounter_1",
                        "name": "Two Mages",
                        "updated_at": "2026-06-19T00:00:00+00:00",
                        "entries": [
                            {
                                "template_id": "mage_template",
                                "count": 2,
                            }
                        ],
                    },
                },
            )

            assert state.encounter_presets["encounter_1"].name == "Two Mages"
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "add",
                            "path": "/encounter_presets/encounter_1",
                            "value": {
                                "id": "encounter_1",
                                "name": "Two Mages",
                                "entries": [
                                    {
                                        "template_id": "mage_template",
                                        "count": 2,
                                    }
                                ],
                                "updated_at": "2026-06-19T00:00:00+00:00",
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


def test_dm_can_edit_encounter_preset_without_changing_stable_id(monkeypatch) -> None:
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
            base_request = {
                "type": "save_encounter_preset",
                "encounter": {
                    "id": "encounter_1",
                    "name": "Two Mages",
                    "updated_at": "2026-06-19T00:00:00+00:00",
                    "entries": [{"template_id": "mage_template", "count": 2}],
                },
            }
            await handle_client_payload(websocket, base_request)
            websocket.sent_messages.clear()

            await handle_client_payload(
                websocket,
                {
                    **base_request,
                    "encounter": {
                        **base_request["encounter"],
                        "name": "Three Mages",
                        "entries": [{"template_id": "mage_template", "count": 3}],
                    },
                },
            )

            assert set(state.encounter_presets) == {"encounter_1"}
            assert state.encounter_presets["encounter_1"].name == "Three Mages"
            assert state.encounter_presets["encounter_1"].entries[0].count == 3
            assert websocket.sent_messages[0]["ops"][0]["op"] == "set"
            assert websocket.sent_messages[0]["ops"][0]["path"] == (
                "/encounter_presets/encounter_1"
            )
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_spawn_encounter_preset(monkeypatch) -> None:
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
                    "type": "save_encounter_preset",
                    "encounter": {
                        "id": "encounter_1",
                        "name": "Two Mages",
                        "updated_at": "2026-06-19T00:00:00+00:00",
                        "entries": [
                            {
                                "template_id": "mage_template",
                                "count": 2,
                            }
                        ],
                    },
                },
            )
            websocket.sent_messages.clear()

            await handle_client_payload(
                websocket,
                {
                    "type": "spawn_encounter_preset",
                    "encounter_id": "encounter_1",
                },
            )

            assert set(state.instanced_sheets) == {
                "encounter_1_mage_template_1",
                "encounter_1_mage_template_2",
            }
            assert state.instanced_sheets["encounter_1_mage_template_1"].health == 120
            assert state.instanced_sheets["encounter_1_mage_template_1"].mana == 32
            assert state.instanced_sheets["encounter_1_mage_template_1"].resistances.fire == 10.0
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "add",
                            "path": "/instanced_sheets/encounter_1_mage_template_1",
                            "value": {
                                "parent_id": "mage_template",
                                "notes": "",
                                "health": 120,
                                "mana": 32,
                                "resistances": _resistances_payload(fire=10.0),
                                "augments": {},
                            },
                        },
                        {
                            "op": "add",
                            "path": "/instanced_sheets/encounter_1_mage_template_2",
                            "value": {
                                "parent_id": "mage_template",
                                "notes": "",
                                "health": 120,
                                "mana": 32,
                                "resistances": _resistances_payload(fire=10.0),
                                "augments": {},
                            },
                        },
                    ],
                    "state_version": 2,
                    "type": "state_patch",
                    "request_id": "req-2",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_delete_encounter_preset(monkeypatch) -> None:
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
                    "type": "save_encounter_preset",
                    "encounter": {
                        "id": "encounter_1",
                        "name": "Two Mages",
                        "updated_at": "2026-06-19T00:00:00+00:00",
                        "entries": [
                            {
                                "template_id": "mage_template",
                                "count": 2,
                            }
                        ],
                    },
                },
            )
            websocket.sent_messages.clear()

            await handle_client_payload(
                websocket,
                {
                    "type": "delete_encounter_preset",
                    "encounter_id": "encounter_1",
                },
            )

            assert "encounter_1" not in state.encounter_presets
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "remove",
                            "path": "/encounter_presets/encounter_1",
                            "value": None,
                        }
                    ],
                    "state_version": 2,
                    "type": "state_patch",
                    "request_id": "req-2",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_missing_encounter_preset_requests_return_errors(monkeypatch) -> None:
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
                    "type": "spawn_encounter_preset",
                    "encounter_id": "missing_encounter",
                },
            )
            await handle_client_payload(
                websocket,
                {
                    "type": "delete_encounter_preset",
                    "encounter_id": "missing_encounter",
                },
            )

            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Encounter preset 'missing_encounter' does not exist.",
                    "type": "error",
                    "request_id": "req-1",
                },
                {
                    "response_id": None,
                    "reason": "Encounter preset 'missing_encounter' does not exist.",
                    "type": "error",
                    "request_id": "req-2",
                },
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_player_cannot_save_encounter_preset(monkeypatch) -> None:
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
                    "type": "save_encounter_preset",
                    "encounter": {
                        "id": "encounter_1",
                        "name": "Two Mages",
                        "entries": [
                            {
                                "template_id": "mage_template",
                                "count": 2,
                            }
                        ],
                    },
                },
            )

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
