import asyncio
from copy import deepcopy

from backend.routes.ws import handle_client_payload, websocket_sessions
from backend.state.models.attribute import synchronize_required_sheet_attributes
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


def _build_sheet_state() -> Sheet:
    sheet = Sheet.from_dict(
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
            "actions": {},
        }
    )
    synchronize_required_sheet_attributes(sheet)
    return sheet


def test_dm_can_set_sheet_base_stat(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            StateSingleton.getState().sheets["mage_template"] = _build_sheet_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "set_sheet_base_stat",
                    "sheet_id": "mage_template",
                    "stat_name": "strength",
                    "value": 18,
                    "request_id": "client-id-ignored",
                },
            )

            assert StateSingleton.getState().sheets["mage_template"].stats.strength == 18
            assert websocket.sent_messages[0]["ops"][0] == {
                "op": "set",
                "path": "/sheets/mage_template/stats/strength",
                "value": 18,
            }
            projection = websocket.sent_messages[0]["ops"][1]
            assert projection["path"] == "/sheets/mage_template/evaluated_stats"
            assert projection["value"]["strength"] == 18
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_set_sheet_formula_stat(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            StateSingleton.getState().sheets["mage_template"] = _build_sheet_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "set_sheet_formula_stat",
                    "sheet_id": "mage_template",
                    "stat_name": "health",
                    "formula": {
                        "aliases": [
                            {
                                "name": "constitution",
                                "path": ["stats", "constitution"],
                            }
                        ],
                        "text": "@constitution * 12",
                    },
                    "request_id": "client-id-ignored",
                },
            )

            assert (
                StateSingleton.getState()
                .sheets["mage_template"]
                .stats.health.text
                == "@constitution * 12"
            )
            assert websocket.sent_messages[0]["ops"][0] == {
                "op": "set",
                "path": "/sheets/mage_template/stats/health",
                "value": {
                    "aliases": [
                        {
                            "name": "constitution",
                            "path": ["stats", "constitution"],
                        }
                    ],
                    "text": "@constitution * 12",
                    "tags": [],
                },
            }
            projection = websocket.sent_messages[0]["ops"][1]
            assert projection["path"] == "/sheets/mage_template/evaluated_stats"
            assert projection["value"]["health"] == 144
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_sheet_formula_stat_rejects_instance_and_self_aliases(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            for alias in (
                {"name": "current_health", "path": ["health"]},
                {"name": "health", "path": ["stats", "health"]},
            ):
                await handle_client_payload(
                    websocket,
                    {
                        "type": "set_sheet_formula_stat",
                        "sheet_id": "mage_template",
                        "stat_name": "health",
                        "formula": {"aliases": [alias], "text": f"@{alias['name']}"},
                    },
                )

            assert state.sheets["mage_template"].stats.health.text == (
                "@constitution * 10"
            )
            assert "unsupported path 'health'" in websocket.sent_messages[0]["reason"]
            assert "cannot reference itself" in websocket.sent_messages[1]["reason"]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_sheet_formula_stat_rejects_cross_attribute_dependency_cycles(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "set_sheet_formula_stat",
                    "sheet_id": "mage_template",
                    "stat_name": "registration",
                    "formula": {
                        "aliases": [
                            {
                                "name": "amount_of_reactions",
                                "path": ["attributes", "amount_of_reactions"],
                            }
                        ],
                        "text": "@amount_of_reactions",
                    },
                },
            )

            assert websocket.sent_messages[-1]["type"] == "error"
            assert "dependency cycle" in websocket.sent_messages[-1]["reason"]
            assert state.sheets["mage_template"].stats.registration.text == "@arcane"
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_set_sheet_resistances_atomically(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "set_sheet_resistances",
                    "sheet_id": "mage_template",
                    "resistances": {
                        "resistance": 0.1,
                        "physical": 0.2,
                        "magical": 0.3,
                        "fire": 0.4,
                    },
                },
            )

            resistances = state.sheets["mage_template"].resistances
            assert resistances.resistance == 0.1
            assert resistances.physical == 0.2
            assert resistances.magical == 0.3
            assert resistances.fire == 0.4
            op = websocket.sent_messages[0]["ops"][0]
            assert op["op"] == "set"
            assert op["path"] == "/sheets/mage_template/resistances"
            assert op["value"]["fire"] == 0.4
            assert op["value"]["ice"] == 0.0
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_sheet_resistance_update_rejects_values_outside_fraction_range(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "set_sheet_resistances",
                    "sheet_id": "mage_template",
                    "resistances": {"fire": 1.01},
                },
            )

            assert state.sheets["mage_template"].resistances.fire == 0.0
            assert "finite fraction from 0 to 1" in websocket.sent_messages[0]["reason"]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_player_cannot_set_sheet_base_stat(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            StateSingleton.getState().sheets["mage_template"] = _build_sheet_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="player")

            await handle_client_payload(
                websocket,
                {
                    "type": "set_sheet_base_stat",
                    "sheet_id": "mage_template",
                    "stat_name": "strength",
                    "value": 18,
                },
            )

            assert StateSingleton.getState().sheets["mage_template"].stats.strength == 10
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Only a DM can edit sheet stats.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_invalid_base_stat_name_is_rejected(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            StateSingleton.getState().sheets["mage_template"] = _build_sheet_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "set_sheet_base_stat",
                    "sheet_id": "mage_template",
                    "stat_name": "health",
                    "value": 18,
                },
            )

            assert StateSingleton.getState().sheets["mage_template"].stats.health.text == (
                "@constitution * 10"
            )
            assert websocket.sent_messages[0]["type"] == "error"
            assert websocket.sent_messages[0]["request_id"] == "req-1"
            assert "stat_name" in websocket.sent_messages[0]["reason"]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_missing_sheet_stat_update_is_rejected(monkeypatch) -> None:
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
                    "type": "set_sheet_base_stat",
                    "sheet_id": "missing",
                    "stat_name": "strength",
                    "value": 18,
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
