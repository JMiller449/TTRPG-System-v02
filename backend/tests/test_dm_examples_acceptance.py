from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from backend.features.chat import service as chat_service
from backend.features.state_sync.service import state_sync_service
from backend.routes.ws import handle_client_payload, websocket_sessions
from backend.state import store as store_module
from backend.state.store import StateSingleton
from backend.tests.dm_examples_fixtures import (
    ACTION_IDS,
    INSTANCE_ID,
    ITEM_IDS,
    SHEET_ID,
    authoring_requests,
)


class FakeWebSocket:
    def __init__(self) -> None:
        self.sent_messages: list[dict] = []

    async def accept(self) -> None:
        return None

    async def send_json(self, payload: dict) -> None:
        self.sent_messages.append(payload)


async def _send(websocket: FakeWebSocket, payload: dict) -> list[dict]:
    start = len(websocket.sent_messages)
    await handle_client_payload(websocket, payload)
    return websocket.sent_messages[start:]


def test_dm_examples_author_persist_reload_equip_and_execute(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def scenario() -> None:
        original_state = StateSingleton._state
        state_path = tmp_path / "dm_examples_state.json"
        monkeypatch.setattr(store_module, "STATE_PATH", state_path)
        try:
            StateSingleton._state = None
            StateSingleton.initializeState()
            await websocket_sessions.reset()
            await state_sync_service.reset()
            await chat_service.roll20_chat_bridge.reset()

            dm = FakeWebSocket()
            bridge = FakeWebSocket()
            await websocket_sessions.connect(dm, role="dm")
            await chat_service.roll20_chat_bridge.connect(bridge)

            for request in authoring_requests(
                mana_manipulation_effect_bonus=7,
            ):
                messages = await _send(dm, request)
                assert messages, request["type"]
                assert all(message["type"] != "error" for message in messages), (
                    request,
                    messages,
                )

            authored = StateSingleton.getState()
            assert set(ITEM_IDS).issubset(authored.items)
            assert set(ACTION_IDS).issubset(authored.actions)
            assert authored.standalone_effect_applications == {}
            assert authored.sheets[SHEET_ID].stats.perception == 12
            assert authored.sheets[SHEET_ID].resistances.resistance == pytest.approx(0.10)
            assert authored.sheets[SHEET_ID].resistances.fire == pytest.approx(0.25)
            assert authored.sheets[SHEET_ID].resistances.magical == pytest.approx(0.10)
            assert authored.items["never_dulls"].facts[
                "weapon_base_damage"
            ].evaluated_value == 15
            assert authored.items["fire_shard"].facts[
                "item_attribute"
            ].evaluated_value == "Fire"
            assert authored.items["sword_of_mana"].facts[
                "item_flat_effect_bonus"
            ].evaluated_value == 50

            persisted_projection_count = len(authored.equipment_effect_projections)
            persisted_augmentation_ids = set(authored.augmentations)
            assert persisted_projection_count == 4

            StateSingleton._state = None
            reloaded = StateSingleton.initializeState()
            assert reloaded.sheets[SHEET_ID].stats.perception == 12
            assert reloaded.sheets[SHEET_ID].resistances.resistance == pytest.approx(0.10)
            assert reloaded.sheets[SHEET_ID].resistances.fire == pytest.approx(0.25)
            assert reloaded.sheets[SHEET_ID].resistances.magical == pytest.approx(0.10)
            assert len(reloaded.equipment_effect_projections) == persisted_projection_count
            assert set(reloaded.augmentations) == persisted_augmentation_ids
            assert reloaded.standalone_effect_applications == {}

            dm.sent_messages.clear()
            bridge.sent_messages.clear()
            unmodified = await _send(
                dm,
                {
                    "type": "perform_action",
                    "sheet_id": INSTANCE_ID,
                    "action_id": "fixture_mana_overload",
                },
            )
            assert unmodified[0]["emitted_messages"] == ["Mana Overload: [[1d100]]"]
            assert "Advantage" not in bridge.sent_messages[-1]["message"]
            assert "+ (7)" not in bridge.sent_messages[-1]["message"]

            await _send(
                dm,
                {
                    "type": "perform_action",
                    "sheet_id": INSTANCE_ID,
                    "action_id": "parry_skill",
                },
            )
            parry_messages = await _send(
                dm,
                {
                    "type": "perform_action",
                    "sheet_id": INSTANCE_ID,
                    "action_id": "weapon_parry",
                    "source_item_relationship_id": "inventory_never_dulls",
                },
            )
            assert parry_messages[0]["type"] == "action_executed"
            assert parry_messages[0]["emitted_messages"][0].startswith(
                "Advantage Weapon Parry:"
            )

            await _send(
                dm,
                {
                    "type": "perform_action",
                    "sheet_id": INSTANCE_ID,
                    "action_id": "mana_manipulation",
                },
            )
            mana_messages = await _send(
                dm,
                {
                    "type": "perform_action",
                    "sheet_id": INSTANCE_ID,
                    "action_id": "fixture_mana_overload",
                },
            )
            mana_output = mana_messages[0]["emitted_messages"][0]
            assert mana_output.startswith("Advantage Mana Overload:")
            assert "+ (7)" in mana_output

            fire_messages = await _send(
                dm,
                {
                    "type": "perform_action",
                    "sheet_id": INSTANCE_ID,
                    "action_id": "fixture_fire_damage",
                },
            )
            assert "+ (10)" in fire_messages[0]["emitted_messages"][0]

            mana_sword_messages = await _send(
                dm,
                {
                    "type": "perform_action",
                    "sheet_id": INSTANCE_ID,
                    "action_id": "weapon_damage",
                    "source_item_relationship_id": "inventory_sword_of_mana",
                },
            )
            assert "(50.0)" in mana_sword_messages[0]["emitted_messages"][0]

            plain_sword_messages = await _send(
                dm,
                {
                    "type": "perform_action",
                    "sheet_id": INSTANCE_ID,
                    "action_id": "weapon_damage",
                    "source_item_relationship_id": "inventory_never_dulls",
                },
            )
            assert "(50.0)" not in plain_sword_messages[0]["emitted_messages"][0]

            await _send(
                dm,
                {
                    "type": "set_instanced_sheet_resource",
                    "instance_id": INSTANCE_ID,
                    "resource": "health",
                    "value": 50,
                },
            )
            await _send(
                dm,
                {
                    "type": "set_instanced_sheet_resource",
                    "instance_id": INSTANCE_ID,
                    "resource": "mana",
                    "value": 90,
                },
            )
            dm.sent_messages.clear()
            failed_flames = await _send(
                dm,
                {
                    "type": "perform_action",
                    "sheet_id": INSTANCE_ID,
                    "action_id": "flames_of_life",
                },
            )
            assert failed_flames == [
                {
                    "response_id": None,
                    "reason": (
                        "State path /instanced_sheets/dm_examples_instance/mana "
                        "would be below minimum 0."
                    ),
                    "type": "error",
                    "request_id": failed_flames[0]["request_id"],
                }
            ]
            assert reloaded.instanced_sheets[INSTANCE_ID].health == 50
            assert reloaded.instanced_sheets[INSTANCE_ID].mana == 90
            assert not any(message["type"] == "state_patch" for message in failed_flames)

            await _send(
                dm,
                {
                    "type": "set_instanced_sheet_resource",
                    "instance_id": INSTANCE_ID,
                    "resource": "mana",
                    "value": 200,
                },
            )
            dm.sent_messages.clear()
            version_before = state_sync_service.current_version
            successful_flames = await _send(
                dm,
                {
                    "type": "perform_action",
                    "sheet_id": INSTANCE_ID,
                    "action_id": "flames_of_life",
                },
            )
            assert successful_flames[0]["type"] == "state_patch"
            assert successful_flames[0]["state_version"] == version_before + 1
            assert successful_flames[0]["ops"] == [
                {
                    "op": "set",
                    "path": f"/instanced_sheets/{INSTANCE_ID}/mana",
                    "value": 100,
                },
                {
                    "op": "set",
                    "path": f"/instanced_sheets/{INSTANCE_ID}/health",
                    "value": 60,
                },
            ]
            assert reloaded.instanced_sheets[INSTANCE_ID].mana == 100
            assert reloaded.instanced_sheets[INSTANCE_ID].health == 60
        finally:
            await websocket_sessions.reset()
            await chat_service.roll20_chat_bridge.reset()
            StateSingleton._state = original_state

    asyncio.run(scenario())
