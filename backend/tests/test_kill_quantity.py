import asyncio
from dataclasses import asdict

import pytest

from backend.tests.test_xp_progression import campaign
from backend.tests.test_xp_tracker import _dm, FakeWebSocket
from backend.routes.ws import handle_client_payload, websocket_sessions
from backend.features.state_sync.service import state_sync_service
from backend.state.models.xp import KillRecord, Party
from backend.state.migrations import migrate_persisted_state


def test_batch_award_edit_reload_and_undo(campaign):
    async def scenario():
        await websocket_sessions.reset()
        await state_sync_service.reset()
        dm = await _dm()
        campaign.parties["party"] = Party(id="party", name="Party", member_instance_ids=["hero_1", "hero_2", "hero_3"])
        payload = {"type": "record_kill", "kill_id": "batch", "credited_instance_id": "hero_1", "monster_sheet_id": "goblin", "quantity": 5, "request_id": "batch-request"}
        await handle_client_payload(dm, payload)
        await handle_client_payload(dm, payload)
        assert len(campaign.kill_registry) == 1
        record = campaign.kill_registry["batch"]
        assert record.quantity == 5
        assert record.base_xp == 100
        assert record.xp_per_participant == 166.65  # Same as five individually rounded awards.
        assert KillRecord.from_dict(asdict(record)) == record
        tracker = next(message for message in reversed(dm.sent_messages) if message["type"] == "xp_tracker")
        assert tracker["kills"][0]["quantity"] == 5
        campaign.parties["party"].member_instance_ids = ["hero_1"]
        edit = {"type": "update_kill", "kill_id": "batch", "monster_sheet_id": "goblin", "monster_name": "Goblin", "base_xp": 100, "participant_instance_ids": ["hero_1", "hero_2", "hero_3"], "occurred_at": record.occurred_at, "quantity": 2}
        await handle_client_payload(dm, edit)
        assert campaign.kill_registry["batch"].xp_per_participant == 66.66
        edit.pop("quantity")
        edit["notes"] = "Preserve quantity when omitted"
        await handle_client_payload(dm, edit)
        assert campaign.kill_registry["batch"].quantity == 2
        await handle_client_payload(dm, {"type": "delete_kill", "kill_id": "batch"})
        assert "batch" not in campaign.kill_registry
        await state_sync_service.undo_last_change()
        assert campaign.kill_registry["batch"].quantity == 2
    asyncio.run(scenario())


@pytest.mark.parametrize("quantity", [0, -1, 1.5, True, "5", 10001])
def test_rejects_invalid_quantities_without_awards(campaign, quantity):
    async def scenario():
        await websocket_sessions.reset()
        dm = await _dm()
        await handle_client_payload(dm, {"type": "record_kill", "kill_id": "invalid", "credited_instance_id": "hero_1", "monster_sheet_id": "goblin", "quantity": quantity})
        assert dm.sent_messages[-1]["type"] == "error"
        assert not campaign.kill_registry
    asyncio.run(scenario())


def test_player_batch_uses_canonical_xp_and_preserves_visibility(campaign):
    async def scenario():
        await websocket_sessions.reset()
        await state_sync_service.reset()
        player = FakeWebSocket()
        await websocket_sessions.connect(player, role="player")
        await websocket_sessions.assign_player_sheet(player, sheet_id="hero", instance_id="hero_1")
        payload = {"type": "record_player_kill", "kill_id": "batch", "monster_sheet_id": "goblin", "quantity": 5}
        await handle_client_payload(player, payload)
        assert not campaign.kill_registry
        campaign.player_kill_visibility["goblin"] = True
        await handle_client_payload(player, {**payload, "base_xp": 10000})
        assert not campaign.kill_registry
        await handle_client_payload(player, payload)
        assert campaign.kill_registry["batch"].xp_per_participant == 500
        assert campaign.kill_registry["batch"].submitted_by_instance_id == "hero_1"
        legacy = asdict(campaign.kill_registry["batch"])
        legacy.pop("quantity")
        migrated = migrate_persisted_state({"schema_version": 51, "state": {"kill_registry": {"batch": legacy}}})
        assert migrated.state["kill_registry"]["batch"]["quantity"] == 1
        assert KillRecord.from_dict(legacy).quantity == 1
    asyncio.run(scenario())
