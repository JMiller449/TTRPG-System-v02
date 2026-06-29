import asyncio
from copy import deepcopy

from backend.routes.ws import handle_client_payload, websocket_sessions
from backend.state.models.action import Action
from backend.state.models.formula import FormulaDefinition
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


def _formula_definition_payload(
    formula_id: str = "max_health",
    text: str = "@constitution * 10",
) -> dict:
    return {
        "id": formula_id,
        "formula": _formula_payload(
            text,
            [{"name": "constitution", "path": ["stats", "constitution"]}],
        ),
    }


def test_dm_can_create_formula(monkeypatch) -> None:
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
                    "type": "create_formula",
                    "formula": _formula_definition_payload(),
                },
            )

            assert StateSingleton.getState().formulas["max_health"].formula.text == (
                "@constitution * 10"
            )
            assert websocket.sent_messages[0]["ops"][0]["op"] == "add"
            assert websocket.sent_messages[0]["ops"][0]["path"] == (
                "/formulas/max_health"
            )
            assert websocket.sent_messages[0]["ops"][0]["value"]["id"] == "max_health"
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_formula_create_normalizes_semantic_tags(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")
            payload = _formula_definition_payload()
            payload["formula"]["tags"] = [
                " Damage ",
                "FIRE",
                "damage",
                "  spell   attack ",
            ]

            await handle_client_payload(
                websocket,
                {
                    "type": "create_formula",
                    "formula": payload,
                },
            )

            formula = StateSingleton.getState().formulas["max_health"].formula
            assert formula.tags == ["damage", "fire", "spell attack"]
            assert websocket.sent_messages[0]["ops"][0]["value"]["formula"][
                "tags"
            ] == ["damage", "fire", "spell attack"]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_update_formula(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.formulas["max_health"] = FormulaDefinition.from_dict(
                _formula_definition_payload()
            )
            state.actions["healing"] = Action.from_dict(
                {
                    "id": "healing",
                    "name": "Healing",
                    "steps": [
                        {
                            "step_id": "calculate",
                            "type": "calculate_value",
                            "variable_id": "healing",
                            "value": {
                                "type": "formula_reference",
                                "formula_id": "max_health",
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
                    "type": "update_formula",
                    "formula_id": "max_health",
                    "formula": _formula_definition_payload(
                        text="@constitution * 12"
                    ),
                },
            )

            assert state.formulas["max_health"].formula.text == "@constitution * 12"
            assert websocket.sent_messages[0]["ops"][0]["op"] == "set"
            assert websocket.sent_messages[0]["ops"][0]["path"] == (
                "/formulas/max_health"
            )
            assert websocket.sent_messages[0]["ops"][0]["value"]["formula"][
                "text"
            ] == "@constitution * 12"
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_delete_formula(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.formulas["max_health"] = FormulaDefinition.from_dict(
                _formula_definition_payload()
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "delete_formula",
                    "formula_id": "max_health",
                },
            )

            assert "max_health" not in state.formulas
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "remove",
                            "path": "/formulas/max_health",
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


def test_delete_formula_rejects_action_references(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.formulas["max_health"] = FormulaDefinition.from_dict(
                _formula_definition_payload()
            )
            state.actions["healing"] = Action.from_dict(
                {
                    "id": "healing",
                    "name": "Healing",
                    "steps": [
                        {
                            "step_id": "calculate",
                            "type": "calculate_value",
                            "variable_id": "healing",
                            "value": {
                                "type": "formula_reference",
                                "formula_id": "max_health",
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
                {"type": "delete_formula", "formula_id": "max_health"},
            )

            assert "max_health" in state.formulas
            assert websocket.sent_messages[0]["reason"] == (
                "Formula 'max_health' is referenced by actions: healing."
            )
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_player_cannot_create_formula(monkeypatch) -> None:
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
                    "type": "create_formula",
                    "formula": _formula_definition_payload(),
                },
            )

            assert StateSingleton.getState().formulas == {}
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


def test_update_formula_rejects_id_change(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.formulas["max_health"] = FormulaDefinition.from_dict(
                _formula_definition_payload()
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "update_formula",
                    "formula_id": "max_health",
                    "formula": _formula_definition_payload(
                        formula_id="other_formula"
                    ),
                },
            )

            assert set(state.formulas) == {"max_health"}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Formula ID cannot be changed.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_create_formula_rejects_unknown_alias_path(monkeypatch) -> None:
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
                    "type": "create_formula",
                    "formula": {
                        "id": "bad_formula",
                        "formula": _formula_payload(
                            "@bad",
                            [{"name": "bad", "path": ["stats", "missing"]}],
                        ),
                    },
                },
            )

            assert StateSingleton.getState().formulas == {}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": (
                        "Formula alias 'bad' references unsupported path "
                        "'stats.missing'."
                    ),
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())
