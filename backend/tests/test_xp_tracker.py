import asyncio
from copy import deepcopy

from backend.features.state_sync.service import state_sync_service
from backend.protocol.socket import normalize_server_event
from backend.routes.ws import handle_client_payload, websocket_sessions
from backend.state.models.sheet import InstancedSheet, Sheet
from backend.state.store import DEFAULT_STATE, StateSingleton


class FakeWebSocket:
    def __init__(self) -> None:
        self.sent_messages: list[dict] = []

    async def accept(self) -> None:
        return None

    async def send_json(self, payload: dict) -> None:
        self.sent_messages.append(payload)


def _formula(text: str = "0") -> dict:
    return {"aliases": None, "text": text}


def _sheet(
    sheet_id: str,
    name: str,
    *,
    dm_only: bool,
    xp_value: int = 0,
    xp_required: str = "",
    kills: dict[str, int] | None = None,
) -> Sheet:
    formula = _formula()
    return Sheet.from_dict(
        {
            "id": sheet_id,
            "name": name,
            "notes": "secret",
            "dm_only": dm_only,
            "xp_given_when_slayed": xp_value,
            "xp_cap": xp_required,
            "proficiencies": {},
            "items": {},
            "stats": {
                "strength": 10,
                "dexterity": 10,
                "constitution": 10,
                "perception": 10,
                "arcane": 10,
                "will": 10,
                "lifting": formula,
                "carry_weight": formula,
                "acrobatics": formula,
                "stamina": formula,
                "reaction_time": formula,
                "health": formula,
                "endurance": formula,
                "pain_tolerance": formula,
                "sight_distance": formula,
                "intuition": formula,
                "registration": formula,
                "mana": formula,
                "control": formula,
                "sensitivity": formula,
                "charisma": formula,
                "mental_fortitude": formula,
                "courage": formula,
            },
            "slayed_record": {
                mob_id: {"sheet_id": mob_id, "count": count}
                for mob_id, count in (kills or {}).items()
            },
            "actions": {},
        }
    )


def _setup_state() -> None:
    StateSingleton._state = deepcopy(DEFAULT_STATE)
    state = StateSingleton.getState()
    state.sheets["hero"] = _sheet(
        "hero",
        "Hero",
        dm_only=False,
        xp_required="100",
        kills={"goblin": 2},
    )
    state.sheets["goblin"] = _sheet(
        "goblin",
        "Goblin",
        dm_only=True,
        xp_value=25,
    )
    state.sheets["dragon"] = _sheet(
        "dragon",
        "Dragon",
        dm_only=True,
        xp_value=0,
    )
    state.instanced_sheets["hero_instance"] = InstancedSheet.from_dict(
        {
            "parent_id": "hero",
            "health": 100,
            "mana": 20,
            "augments": {},
        }
    )


def test_dm_tracker_includes_backend_calculated_progress(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _setup_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(websocket, {"type": "get_xp_tracker"})

            tracker = websocket.sent_messages[0]
            assert tracker["type"] == "xp_tracker"
            assert tracker["can_view_progress"] is True
            assert tracker["sheets"] == [
                {
                    "sheet_id": "hero",
                    "name": "Hero",
                    "mobs": [
                        {
                            "sheet_id": "goblin",
                            "name": "Goblin",
                            "count": 2,
                            "xp_value": 25,
                            "xp_earned": 50,
                        }
                    ],
                    "current_xp": 50,
                    "xp_required": 100,
                    "ready_to_level": False,
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_player_tracker_hides_all_xp_progress(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _setup_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="player")
            await websocket_sessions.assign_player_sheet(
                websocket,
                sheet_id="hero",
                instance_id="hero_instance",
            )

            await handle_client_payload(websocket, {"type": "get_xp_tracker"})

            tracker = websocket.sent_messages[0]
            assert tracker["can_view_progress"] is False
            assert tracker["sheets"][0]["current_xp"] is None
            assert tracker["sheets"][0]["xp_required"] is None
            assert tracker["sheets"][0]["ready_to_level"] is None
            assert tracker["sheets"][0]["mobs"] == [
                {
                    "sheet_id": "goblin",
                    "name": "Goblin",
                    "count": 2,
                    "xp_value": None,
                    "xp_earned": None,
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_player_can_update_own_mob_kill_count(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _setup_state()
            await websocket_sessions.reset()
            await state_sync_service.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="player")
            await websocket_sessions.assign_player_sheet(
                websocket,
                sheet_id="hero",
                instance_id="hero_instance",
            )

            await handle_client_payload(
                websocket,
                {
                    "type": "set_sheet_mob_kill_count",
                    "sheet_id": "hero_instance",
                    "mob_sheet_id": "goblin",
                    "count": 4,
                },
            )

            assert StateSingleton.getState().sheets["hero"].slayed_record[
                "goblin"
            ].count == 4
            assert websocket.sent_messages[0]["type"] == "state_patch"
            assert websocket.sent_messages[0]["ops"][0]["path"] == (
                "/sheets/hero/slayed_record/goblin"
            )
            tracker = websocket.sent_messages[1]
            assert tracker["type"] == "xp_tracker"
            assert tracker["sheets"][0]["mobs"][0]["count"] == 4
            assert tracker["sheets"][0]["current_xp"] is None
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_duplicate_player_kill_request_is_rejected_without_second_mutation(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _setup_state()
            await websocket_sessions.reset()
            await state_sync_service.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="player")
            await websocket_sessions.assign_player_sheet(
                websocket,
                sheet_id="hero",
                instance_id="hero_instance",
            )
            payload = {
                "type": "set_sheet_mob_kill_count",
                "sheet_id": "hero_instance",
                "mob_sheet_id": "goblin",
                "count": 4,
                "request_id": "kill-retry-1",
            }

            await handle_client_payload(websocket, payload)
            await handle_client_payload(websocket, payload)

            assert StateSingleton.getState().sheets["hero"].slayed_record[
                "goblin"
            ].count == 4
            assert state_sync_service.current_version == 1
            assert websocket.sent_messages[-1] == {
                "response_id": None,
                "reason": (
                    "Duplicate request 'kill-retry-1' was ignored; its state "
                    "mutation was already processed."
                ),
                "type": "error",
                "request_id": "kill-retry-1",
            }
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_player_cannot_update_another_sheet_kill_count(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _setup_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="player")
            await websocket_sessions.assign_player_sheet(
                websocket,
                sheet_id="hero",
                instance_id="hero_instance",
            )

            await handle_client_payload(
                websocket,
                {
                    "type": "set_sheet_mob_kill_count",
                    "sheet_id": "other_instance",
                    "mob_sheet_id": "goblin",
                    "count": 4,
                },
            )

            assert websocket.sent_messages[0]["type"] == "error"
            assert "assigned sheet instance" in websocket.sent_messages[0]["reason"]
            assert StateSingleton.getState().sheets["hero"].slayed_record[
                "goblin"
            ].count == 2
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_configure_threshold_and_mob_value(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _setup_state()
            await websocket_sessions.reset()
            await state_sync_service.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "set_sheet_xp_required",
                    "sheet_id": "hero",
                    "xp_required": 60,
                },
            )
            await handle_client_payload(
                websocket,
                {
                    "type": "set_mob_xp_value",
                    "mob_sheet_id": "goblin",
                    "xp_value": 30,
                },
            )

            state = StateSingleton.getState()
            assert state.sheets["hero"].xp_cap == "60"
            assert state.sheets["goblin"].xp_given_when_slayed == 30
            latest_tracker = websocket.sent_messages[-1]
            assert latest_tracker["type"] == "xp_tracker"
            assert latest_tracker["sheets"][0]["current_xp"] == 60
            assert latest_tracker["sheets"][0]["ready_to_level"] is True
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_player_snapshot_redacts_xp_configuration(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _setup_state()
            player_snapshot = normalize_server_event(
                await state_sync_service.snapshot(role="player")
            )
            dm_snapshot = normalize_server_event(
                await state_sync_service.snapshot(role="dm")
            )

            assert player_snapshot["state"]["sheets"]["hero"]["xp_cap"] == ""
            assert (
                player_snapshot["state"]["sheets"]["goblin"][
                    "xp_given_when_slayed"
                ]
                == 0
            )
            assert dm_snapshot["state"]["sheets"]["hero"]["xp_cap"] == "100"
            assert (
                dm_snapshot["state"]["sheets"]["goblin"][
                    "xp_given_when_slayed"
                ]
                == 25
            )
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())
