import asyncio
from copy import deepcopy

from backend.features.state_sync import handler as state_sync_handler
from backend.features.state_sync.schema import ResyncState
from backend.features.session.service import websocket_sessions
from backend.features.state_sync.service import state_sync_service
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


def _reset_state() -> None:
    StateSingleton._state = deepcopy(DEFAULT_STATE)


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
                "lifting": {"aliases": [{"name": "strength", "path": ["strength"]}], "text": "@strength * 2"},
                "carry_weight": {"aliases": [{"name": "strength", "path": ["strength"]}], "text": "@strength * 3"},
                "acrobatics": {"aliases": [{"name": "dexterity", "path": ["dexterity"]}], "text": "@dexterity"},
                "stamina": {"aliases": [{"name": "constitution", "path": ["constitution"]}], "text": "@constitution"},
                "reaction_time": {"aliases": [{"name": "dexterity", "path": ["dexterity"]}], "text": "@dexterity"},
                "health": {"aliases": [{"name": "constitution", "path": ["constitution"]}], "text": "@constitution * 10"},
                "endurance": {"aliases": [{"name": "constitution", "path": ["constitution"]}], "text": "@constitution * 2"},
                "pain_tolerance": {"aliases": [{"name": "will", "path": ["will"]}], "text": "@will"},
                "sight_distance": {"aliases": [{"name": "perception", "path": ["perception"]}], "text": "@perception * 4"},
                "intuition": {"aliases": [{"name": "perception", "path": ["perception"]}], "text": "@perception"},
                "registration": {"aliases": [{"name": "arcane", "path": ["arcane"]}], "text": "@arcane"},
                "mana": {"aliases": [{"name": "arcane", "path": ["arcane"]}], "text": "@arcane * 8"},
                "control": {"aliases": [{"name": "arcane", "path": ["arcane"]}], "text": "@arcane"},
                "sensitivity": {"aliases": [{"name": "arcane", "path": ["arcane"]}], "text": "@arcane"},
                "charisma": {"aliases": [{"name": "will", "path": ["will"]}], "text": "@will"},
                "mental_fortitude": {"aliases": [{"name": "will", "path": ["will"]}], "text": "@will * 2"},
                "courage": {"aliases": [{"name": "will", "path": ["will"]}], "text": "@will"},
            },
            "slayed_record": {},
            "actions": {},
        }
    )


def test_state_sync_increment_and_decrement_are_broadcast(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            StateSingleton.getState().sheets["mage_template"] = _build_sheet_state()
            await websocket_sessions.reset()
            dm_socket = FakeWebSocket()
            player_socket = FakeWebSocket()
            await websocket_sessions.connect(dm_socket, role="dm")
            await websocket_sessions.connect(player_socket, role="player")

            await state_sync_service.increment("/sheets/mage_template/stats/strength", 2, request_id="req-1")
            await state_sync_service.decrement("/sheets/mage_template/stats/strength", 1, request_id="req-2")

            assert StateSingleton.getState().sheets["mage_template"].stats.strength == 11
            assert dm_socket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "inc",
                            "path": "/sheets/mage_template/stats/strength",
                            "value": 2,
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
                            "op": "inc",
                            "path": "/sheets/mage_template/stats/strength",
                            "value": -1,
                        }
                    ],
                    "state_version": 2,
                    "type": "state_patch",
                    "request_id": "req-2",
                },
            ]
            assert player_socket.sent_messages == dm_socket.sent_messages
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_resync_state_replays_missing_patches(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            StateSingleton.getState().sheets["mage_template"] = _build_sheet_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            session = await websocket_sessions.connect(websocket, role="player")

            await state_sync_service.increment("/sheets/mage_template/stats/strength", 2, request_id="req-1")
            await state_sync_service.decrement("/sheets/mage_template/stats/strength", 1, request_id="req-2")
            websocket.sent_messages.clear()

            await state_sync_handler.handle_request(
                session,
                ResyncState(
                    type="resync_state",
                    last_seen_version=0,
                    request_id="req-3",
                ),
            )

            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "inc",
                            "path": "/sheets/mage_template/stats/strength",
                            "value": 2,
                        }
                    ],
                    "state_version": 1,
                    "type": "state_patch",
                    "request_id": "req-3",
                },
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "inc",
                            "path": "/sheets/mage_template/stats/strength",
                            "value": -1,
                        }
                    ],
                    "state_version": 2,
                    "type": "state_patch",
                    "request_id": "req-3",
                },
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_resync_state_falls_back_to_snapshot_on_invalid_version(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            StateSingleton.getState().sheets["mage_template"] = _build_sheet_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            session = await websocket_sessions.connect(websocket, role="player")

            await state_sync_service.increment("/sheets/mage_template/stats/strength", 2, request_id="req-1")
            websocket.sent_messages.clear()

            await state_sync_handler.handle_request(
                session,
                ResyncState(
                    type="resync_state",
                    last_seen_version=99,
                    request_id="req-2",
                ),
            )

            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "state": StateSingleton.getState().to_dict(),
                    "state_version": 1,
                    "type": "state_snapshot",
                    "request_id": "req-2",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())
