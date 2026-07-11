import asyncio
from copy import deepcopy

from backend.features.state_sync.service import state_sync_service
from backend.routes.ws import handle_client_payload, websocket_sessions
from backend.state.models.sheet import InstancedSheet, Sheet
from backend.state.models.state import State
from backend.state.store import DEFAULT_STATE, StateSingleton


class FakeWebSocket:
    def __init__(self) -> None:
        self.sent_messages: list[dict] = []

    async def accept(self) -> None:
        return None

    async def send_json(self, payload: dict) -> None:
        self.sent_messages.append(payload)


def _sheet(sheet_id: str, name: str, *, dm_only: bool, xp: float = 0) -> Sheet:
    formula = {"aliases": None, "text": "0"}
    return Sheet.from_dict(
        {
            "id": sheet_id,
            "name": name,
            "notes": "",
            "dm_only": dm_only,
            "xp_given_when_slayed": xp if dm_only else 0,
            "xp_cap": 100 if not dm_only else 0,
            "proficiencies": {},
            "items": {},
            "stats": {
                "strength": 10,
                "dexterity": 10,
                "constitution": 10,
                "perception": 10,
                "arcane": 10,
                "will": 10,
                **{
                    key: formula
                    for key in (
                        "lifting",
                        "carry_weight",
                        "acrobatics",
                        "stamina",
                        "reaction_time",
                        "health",
                        "endurance",
                        "pain_tolerance",
                        "sight_distance",
                        "intuition",
                        "registration",
                        "mana",
                        "control",
                        "sensitivity",
                        "charisma",
                        "mental_fortitude",
                        "courage",
                    )
                },
            },
            "actions": {},
        }
    )


def _setup_state() -> None:
    StateSingleton._state = deepcopy(DEFAULT_STATE)
    state = StateSingleton.getState()
    state.sheets["hero"] = _sheet("hero", "Hero", dm_only=False)
    state.sheets["goblin"] = _sheet("goblin", "Goblin", dm_only=True, xp=100)
    for index in range(1, 5):
        state.instanced_sheets[f"hero_{index}"] = InstancedSheet.from_dict(
            {
                "parent_id": "hero",
                "health": 100,
                "mana": 20,
                "augments": {},
            },
            template=state.sheets["hero"],
        )


async def _dm() -> FakeWebSocket:
    websocket = FakeWebSocket()
    await websocket_sessions.connect(websocket, role="dm")
    return websocket


def test_ungrouped_kill_records_solo_full_credit(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _setup_state()
            await websocket_sessions.reset()
            await state_sync_service.reset()
            websocket = await _dm()

            await handle_client_payload(
                websocket,
                {
                    "type": "record_kill",
                    "kill_id": "kill_1",
                    "credited_instance_id": "hero_1",
                    "monster_sheet_id": "goblin",
                },
            )

            record = StateSingleton.getState().kill_registry["kill_1"]
            assert [participant.instance_id for participant in record.participants] == [
                "hero_1"
            ]
            assert record.participant_count == 1
            assert record.xp_percentage == 100
            assert record.xp_per_participant == 100
            assert websocket.sent_messages[0]["ops"][0]["path"] == (
                "/kill_registry/kill_1"
            )
            assert websocket.sent_messages[-1]["sheets"][0]["current_xp"] == 100
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_party_kill_snapshots_all_members_and_decimal_share(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _setup_state()
            await websocket_sessions.reset()
            await state_sync_service.reset()
            websocket = await _dm()
            members = [f"hero_{index}" for index in range(1, 5)]

            await handle_client_payload(
                websocket,
                {
                    "type": "save_party",
                    "party_id": "party_1",
                    "name": "Nearby Heroes",
                    "member_instance_ids": members,
                },
            )
            await handle_client_payload(
                websocket,
                {
                    "type": "record_kill",
                    "kill_id": "kill_1",
                    "credited_instance_id": "hero_2",
                    "monster_sheet_id": "goblin",
                },
            )

            record = StateSingleton.getState().kill_registry["kill_1"]
            assert [participant.instance_id for participant in record.participants] == members
            assert record.participant_count == 4
            assert record.xp_percentage == 25
            assert record.xp_per_participant == 25
            assert not hasattr(record, "party_id")
            assert not hasattr(record, "party_name")
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_party_changes_do_not_rewrite_historical_kill(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _setup_state()
            await websocket_sessions.reset()
            await state_sync_service.reset()
            websocket = await _dm()

            await handle_client_payload(
                websocket,
                {
                    "type": "save_party",
                    "party_id": "party_1",
                    "name": "Party",
                    "member_instance_ids": ["hero_1", "hero_2", "hero_3"],
                },
            )
            await handle_client_payload(
                websocket,
                {
                    "type": "record_kill",
                    "kill_id": "kill_1",
                    "credited_instance_id": "hero_1",
                    "monster_sheet_id": "goblin",
                },
            )
            await handle_client_payload(
                websocket,
                {
                    "type": "save_party",
                    "party_id": "party_1",
                    "name": "Party",
                    "member_instance_ids": ["hero_1"],
                },
            )

            record = StateSingleton.getState().kill_registry["kill_1"]
            assert record.participant_count == 3
            assert record.xp_percentage == 33.33
            assert record.xp_per_participant == 33.33
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_edit_delete_kills_and_manage_adjustments(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _setup_state()
            await websocket_sessions.reset()
            await state_sync_service.reset()
            websocket = await _dm()
            await handle_client_payload(
                websocket,
                {
                    "type": "record_kill",
                    "kill_id": "kill_1",
                    "credited_instance_id": "hero_1",
                    "monster_name": "Custom Threat",
                    "base_xp": 10.555,
                    "occurred_at": "2026-07-01T00:00:00+00:00",
                },
            )
            await handle_client_payload(
                websocket,
                {
                    "type": "update_kill",
                    "kill_id": "kill_1",
                    "monster_name": "Corrected Threat",
                    "base_xp": 50,
                    "participant_instance_ids": ["hero_1", "hero_2"],
                    "occurred_at": "2026-07-01T00:00:00+00:00",
                },
            )
            await handle_client_payload(
                websocket,
                {
                    "type": "save_xp_adjustment",
                    "adjustment_id": "adjustment_1",
                    "instance_id": "hero_1",
                    "amount": -2.345,
                    "reason": "Correction",
                },
            )

            state = StateSingleton.getState()
            assert state.kill_registry["kill_1"].monster_name == "Corrected Threat"
            assert state.kill_registry["kill_1"].xp_per_participant == 25
            assert state.xp_adjustments["adjustment_1"].amount == -2.35
            assert websocket.sent_messages[-1]["sheets"][0]["current_xp"] == 22.65

            await handle_client_payload(
                websocket, {"type": "delete_kill", "kill_id": "kill_1"}
            )
            await handle_client_payload(
                websocket,
                {
                    "type": "delete_xp_adjustment",
                    "adjustment_id": "adjustment_1",
                },
            )
            assert state.kill_registry == {}
            assert state.xp_adjustments == {}
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_player_receives_only_assigned_instance_history(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _setup_state()
            await websocket_sessions.reset()
            await state_sync_service.reset()
            dm = await _dm()
            await handle_client_payload(
                dm,
                {
                    "type": "record_kill",
                    "kill_id": "kill_1",
                    "credited_instance_id": "hero_1",
                    "monster_sheet_id": "goblin",
                },
            )
            player = FakeWebSocket()
            await websocket_sessions.connect(player, role="player")
            await websocket_sessions.assign_player_sheet(
                player, sheet_id="hero", instance_id="hero_2"
            )

            await handle_client_payload(player, {"type": "get_xp_tracker"})
            tracker = player.sent_messages[-1]
            assert tracker["can_manage"] is False
            assert tracker["sheets"][0]["instance_id"] == "hero_2"
            assert tracker["sheets"][0]["current_xp"] == 0
            assert tracker["kills"] == []
            assert tracker["parties"] == []

            await handle_client_payload(
                player,
                {
                    "type": "record_kill",
                    "kill_id": "forbidden",
                    "credited_instance_id": "hero_2",
                    "monster_sheet_id": "goblin",
                },
            )
            assert player.sent_messages[-1]["type"] == "error"
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_despawn_removes_current_membership_but_preserves_kill(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _setup_state()
            await websocket_sessions.reset()
            await state_sync_service.reset()
            websocket = await _dm()
            await handle_client_payload(
                websocket,
                {
                    "type": "save_party",
                    "party_id": "party_1",
                    "name": "Party",
                    "member_instance_ids": ["hero_1", "hero_2"],
                },
            )
            await handle_client_payload(
                websocket,
                {
                    "type": "record_kill",
                    "kill_id": "kill_1",
                    "credited_instance_id": "hero_1",
                    "monster_sheet_id": "goblin",
                },
            )

            await handle_client_payload(
                websocket,
                {"type": "delete_instanced_sheet", "instance_id": "hero_2"},
            )

            state = StateSingleton.getState()
            assert state.parties["party_1"].member_instance_ids == ["hero_1"]
            assert [
                participant.instance_id
                for participant in state.kill_registry["kill_1"].participants
            ] == ["hero_1", "hero_2"]
            assert websocket.sent_messages[-1]["type"] == "xp_tracker"
            assert all(
                sheet["instance_id"] != "hero_2"
                for sheet in websocket.sent_messages[-1]["sheets"]
            )
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_reload_rederives_kill_awards_from_participant_snapshot() -> None:
    original_state = deepcopy(StateSingleton.getState())
    try:
        _setup_state()
        state = StateSingleton.getState()
        payload = state.to_dict(include_private=True)
        payload["kill_registry"] = {
            "kill_1": {
                "id": "kill_1",
                "monster_name": "Goblin",
                "base_xp": 100,
                "participants": [
                    {"instance_id": "hero_1", "name": "Hero"},
                    {"instance_id": "hero_2", "name": "Hero"},
                    {"instance_id": "hero_3", "name": "Hero"},
                ],
                "participant_count": 99,
                "xp_percentage": 1,
                "xp_per_participant": 999,
                "occurred_at": "2026-07-01T00:00:00+00:00",
            }
        }

        reloaded = State.from_dict(payload)

        record = reloaded.kill_registry["kill_1"]
        assert record.participant_count == 3
        assert record.xp_percentage == 33.33
        assert record.xp_per_participant == 33.33
    finally:
        StateSingleton._state = original_state
