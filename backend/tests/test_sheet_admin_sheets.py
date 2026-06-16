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


def _sheet_payload(sheet_id: str = "mage_template", name: str = "Mage Template") -> dict:
    return {
        "id": sheet_id,
        "name": name,
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
                    "sheet": _sheet_payload(),
                },
            )

            sheet = StateSingleton.getState().sheets["mage_template"]
            assert sheet.name == "Mage Template"
            assert websocket.sent_messages[0]["ops"][0]["op"] == "add"
            assert websocket.sent_messages[0]["ops"][0]["path"] == (
                "/sheets/mage_template"
            )
            assert websocket.sent_messages[0]["ops"][0]["value"]["id"] == (
                "mage_template"
            )
            assert websocket.sent_messages[0]["type"] == "state_patch"
            assert websocket.sent_messages[0]["request_id"] == "req-1"
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


def test_player_cannot_create_sheet(monkeypatch) -> None:
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
