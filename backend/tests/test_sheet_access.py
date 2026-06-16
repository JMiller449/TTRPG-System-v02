import asyncio
from copy import deepcopy

from backend.features.sheet_access import service as sheet_access_service
from backend.features.state_sync.service import state_sync_service
from backend.routes.ws import handle_client_payload, websocket_sessions
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


def _formula_payload(text: str, aliases: list[dict] | None = None) -> dict:
    return {
        "aliases": aliases,
        "text": text,
    }


def _build_sheet() -> Sheet:
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
    )


def _build_instance() -> InstancedSheet:
    return InstancedSheet.from_dict(
        {
            "parent_id": "mage_template",
            "health": 100,
            "mana": 20,
            "augments": {},
        }
    )


def test_dm_can_generate_sheet_access_code(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        monkeypatch.setattr(
            sheet_access_service, "_generate_access_code", lambda: "MAGE2026"
        )
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet()
            state.instanced_sheets["mage_instance"] = _build_instance()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "generate_sheet_access_code",
                    "sheet_id": "mage_template",
                    "instance_id": "mage_instance",
                },
            )

            assert state.sheet_access_codes["MAGE2026"].sheet_id == "mage_template"
            assert state.sheet_access_codes["MAGE2026"].instance_id == "mage_instance"
            assert websocket.sent_messages == [
                {
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
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_list_sheet_access_codes(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        monkeypatch.setattr(
            sheet_access_service, "_generate_access_code", lambda: "MAGE2026"
        )
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet()
            await sheet_access_service.generate_sheet_access_code(
                sheet_id="mage_template",
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "get_sheet_access_codes",
                },
            )

            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "codes": [
                        {
                            "code": "MAGE2026",
                            "sheet_id": "mage_template",
                            "instance_id": None,
                            "active": True,
                        }
                    ],
                    "type": "sheet_access_codes",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_player_cannot_generate_sheet_access_code(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            StateSingleton.getState().sheets["mage_template"] = _build_sheet()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="player")

            await handle_client_payload(
                websocket,
                {
                    "type": "generate_sheet_access_code",
                    "sheet_id": "mage_template",
                },
            )

            assert StateSingleton.getState().sheet_access_codes == {}
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


def test_generate_sheet_access_code_rejects_mismatched_instance(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet()
            state.sheets["other_template"] = _build_sheet()
            state.sheets["other_template"].id = "other_template"
            state.instanced_sheets["mage_instance"] = _build_instance()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "generate_sheet_access_code",
                    "sheet_id": "other_template",
                    "instance_id": "mage_instance",
                },
            )

            assert state.sheet_access_codes == {}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Instance 'mage_instance' does not belong to sheet 'other_template'.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_public_snapshot_excludes_private_sheet_access_codes(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        monkeypatch.setattr(
            sheet_access_service, "_generate_access_code", lambda: "MAGE2026"
        )
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet()
            await sheet_access_service.generate_sheet_access_code(
                sheet_id="mage_template",
            )

            snapshot = await state_sync_service.snapshot()

            assert "sheet_access_codes" not in snapshot.state
            assert "sheet_access_codes" in state.to_dict(include_private=True)
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())
