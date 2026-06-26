import asyncio
from copy import deepcopy

from backend.routes.ws import handle_client_payload, websocket_sessions
from backend.state.models.action import Action
from backend.state.models.shared import Bridge
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


def _sheet_payload(sheet_id: str = "mage_template") -> dict:
    return {
        "id": sheet_id,
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


def _action_payload(action_id: str = "cast_spell") -> dict:
    return {
        "id": action_id,
        "name": "Cast Spell",
        "notes": "",
        "steps": [
            {
                "step_id": "step-1",
                "type": "send_message",
                "message": _formula_payload("Casting"),
            }
        ],
    }


def _bridge_payload(
    relationship_id: str = "spell",
    action_id: str = "cast_spell",
) -> dict:
    return {
        "relationship_id": relationship_id,
        "action_id": action_id,
    }


def test_dm_can_create_sheet_action_bridge(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
            state.actions["cast_spell"] = Action.from_dict(_action_payload())
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "create_sheet_action_bridge",
                    "sheet_id": "mage_template",
                    "bridge": _bridge_payload(),
                },
            )

            bridge = state.sheets["mage_template"].actions["spell"]
            assert bridge.relationship_id == "spell"
            assert bridge.entry_id == "cast_spell"
            assert websocket.sent_messages[0]["ops"][0] == {
                "op": "add",
                "path": "/sheets/mage_template/actions/spell",
                "value": {
                    "relationship_id": "spell",
                    "entry_id": "cast_spell",
                },
            }
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_update_sheet_action_bridge(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
            state.sheets["mage_template"].actions["spell"] = Bridge.from_dict(
                {
                    "relationship_id": "spell",
                    "entry_id": "cast_spell",
                }
            )
            state.actions["cast_spell"] = Action.from_dict(_action_payload())
            state.actions["focused_cast"] = Action.from_dict(
                _action_payload("focused_cast")
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "update_sheet_action_bridge",
                    "sheet_id": "mage_template",
                    "relationship_id": "spell",
                    "bridge": _bridge_payload(action_id="focused_cast"),
                },
            )

            bridge = state.sheets["mage_template"].actions["spell"]
            assert bridge.entry_id == "focused_cast"
            assert websocket.sent_messages[0]["ops"][0] == {
                "op": "set",
                "path": "/sheets/mage_template/actions/spell",
                "value": {
                    "relationship_id": "spell",
                    "entry_id": "focused_cast",
                },
            }
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_delete_sheet_action_bridge(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
            state.sheets["mage_template"].actions["spell"] = Bridge.from_dict(
                {
                    "relationship_id": "spell",
                    "entry_id": "cast_spell",
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "delete_sheet_action_bridge",
                    "sheet_id": "mage_template",
                    "relationship_id": "spell",
                },
            )

            assert state.sheets["mage_template"].actions == {}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "remove",
                            "path": "/sheets/mage_template/actions/spell",
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


def test_player_cannot_create_sheet_action_bridge(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
            state.actions["cast_spell"] = Action.from_dict(_action_payload())
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="player")

            await handle_client_payload(
                websocket,
                {
                    "type": "create_sheet_action_bridge",
                    "sheet_id": "mage_template",
                    "bridge": _bridge_payload(),
                },
            )

            assert state.sheets["mage_template"].actions == {}
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


def test_create_sheet_action_bridge_rejects_missing_action(monkeypatch) -> None:
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
                    "type": "create_sheet_action_bridge",
                    "sheet_id": "mage_template",
                    "bridge": _bridge_payload(action_id="missing"),
                },
            )

            assert state.sheets["mage_template"].actions == {}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Action 'missing' does not exist.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_create_sheet_action_bridge_rejects_duplicate_relationship(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
            state.sheets["mage_template"].actions["spell"] = Bridge.from_dict(
                {
                    "relationship_id": "spell",
                    "entry_id": "cast_spell",
                }
            )
            state.actions["cast_spell"] = Action.from_dict(_action_payload())
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "create_sheet_action_bridge",
                    "sheet_id": "mage_template",
                    "bridge": _bridge_payload(),
                },
            )

            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Sheet action bridge 'spell' already exists.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_update_sheet_action_bridge_rejects_id_change(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = Sheet.from_dict(_sheet_payload())
            state.sheets["mage_template"].actions["spell"] = Bridge.from_dict(
                {
                    "relationship_id": "spell",
                    "entry_id": "cast_spell",
                }
            )
            state.actions["cast_spell"] = Action.from_dict(_action_payload())
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "update_sheet_action_bridge",
                    "sheet_id": "mage_template",
                    "relationship_id": "spell",
                    "bridge": _bridge_payload(relationship_id="other"),
                },
            )

            assert set(state.sheets["mage_template"].actions) == {"spell"}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Sheet action bridge ID cannot be changed.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_delete_sheet_action_bridge_rejects_missing_relationship(monkeypatch) -> None:
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
                    "type": "delete_sheet_action_bridge",
                    "sheet_id": "mage_template",
                    "relationship_id": "missing",
                },
            )

            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Sheet action bridge 'missing' does not exist.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())
