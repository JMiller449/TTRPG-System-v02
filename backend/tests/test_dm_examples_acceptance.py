from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from backend.dev.dm_examples import (
    ACTION_IDS,
    CAMPAIGN_ATTRIBUTE_IDS,
    CONDITION_IDS,
    CUSTOM_PROFICIENCY_IDS,
    ENCOUNTER_IDS,
    ENEMY_TEMPLATE_IDS,
    FORMULA_IDS,
    INSTANCE_ID,
    ITEM_IDS,
    PLAYER_TEMPLATE_IDS,
    SHEET_ID,
    SHADOWBLADE_INSTANCE_ID,
    STARTER_ACTION_IDS,
    STARTER_ITEM_IDS,
    authoring_requests,
)
from backend.features.chat import service as chat_service
from backend.features.state_sync.service import state_sync_service
from backend.routes.ws import handle_client_payload, websocket_sessions
from backend.state import store as store_module
from backend.state.store import StateSingleton


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
            assert set(STARTER_ITEM_IDS).issubset(authored.items)
            assert set(STARTER_ACTION_IDS).issubset(authored.actions)
            assert set(PLAYER_TEMPLATE_IDS).issubset(authored.sheets)
            assert set(ENEMY_TEMPLATE_IDS).issubset(authored.sheets)
            assert set(FORMULA_IDS).issubset(authored.formulas)
            assert all(
                authored.sheets[sheet_id].dm_only
                for sheet_id in ENEMY_TEMPLATE_IDS
            )
            assert {"amount_of_reactions", "weapon_base_damage"}.issubset(
                authored.attributes
            )
            assert set(CAMPAIGN_ATTRIBUTE_IDS).issubset(authored.attributes)
            assert set(CUSTOM_PROFICIENCY_IDS).issubset(authored.proficiencies)
            assert set(CONDITION_IDS).issubset(authored.condition_presets)
            assert set(ENCOUNTER_IDS).issubset(authored.encounter_presets)
            assert authored.standalone_effect_applications == {}
            assert authored.sheets[SHEET_ID].stats.perception == 12
            assert authored.sheets[SHEET_ID].resistances.resistance == pytest.approx(0.10)
            assert authored.sheets[SHEET_ID].resistances.fire == pytest.approx(0.25)
            assert authored.sheets[SHEET_ID].resistances.magical == pytest.approx(0.10)
            assert "amount_of_reactions" in authored.sheets[SHEET_ID].attributes
            assert authored.sheets[SHEET_ID].attributes[
                "gate_affinity"
            ].evaluated_value == "Fire"
            assert authored.sheets["starter_shadowblade_template"].attributes[
                "gate_affinity"
            ].evaluated_value == "Shadow"
            assert authored.items["lesser_mana_vial"].interaction_type == "consumable"
            assert authored.items["hunter_license"].interaction_type == "inventory_only"
            assert authored.items["night_fang"].attribute_profile == "weapon"
            assert authored.condition_presets["shadow_bound"].visibility == "public"
            assert authored.encounter_presets["red_gate_scouts"].entries[0].count == 3
            assert authored.items["never_dulls"].attributes[
                "weapon_base_damage"
            ].evaluated_value == 15
            assert authored.items["fire_shard"].attributes[
                "item_attribute"
            ].evaluated_value == "Fire"
            assert authored.items["sword_of_mana"].attributes[
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
            assert set(ENCOUNTER_IDS).issubset(reloaded.encounter_presets)
            assert set(CONDITION_IDS).issubset(reloaded.condition_presets)
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

            await _send(
                dm,
                {
                    "type": "perform_action",
                    "sheet_id": SHADOWBLADE_INSTANCE_ID,
                    "action_id": "lesser_mana_vial_drink",
                    "source_item_relationship_id": "inventory_lesser_mana_vial",
                },
            )
            shadow_sheet = reloaded.sheets["starter_shadowblade_template"]
            assert reloaded.instanced_sheets[SHADOWBLADE_INSTANCE_ID].mana == 105
            assert shadow_sheet.items["inventory_lesser_mana_vial"].count == 1

            before_shadow_step_uses = shadow_sheet.proficiencies[
                "fixture_shadow_steps"
            ].use_count
            await _send(
                dm,
                {
                    "type": "perform_action",
                    "sheet_id": SHADOWBLADE_INSTANCE_ID,
                    "action_id": "train_shadow_steps",
                },
            )
            assert shadow_sheet.proficiencies[
                "fixture_shadow_steps"
            ].use_count == before_shadow_step_uses + 1

            await _send(
                dm,
                {
                    "type": "perform_action",
                    "sheet_id": SHADOWBLADE_INSTANCE_ID,
                    "action_id": "apply_shadow_bound",
                },
            )
            assert (
                f"condition:shadow_bound:{SHADOWBLADE_INSTANCE_ID}"
                in reloaded.active_conditions
            )
            bridge.sent_messages.clear()
            dodge_messages = await _send(
                dm,
                {
                    "type": "perform_action",
                    "sheet_id": SHADOWBLADE_INSTANCE_ID,
                    "action_id": "dodge",
                },
            )
            assert dodge_messages[0]["type"] == "action_executed"
            assert "Disadvantage Dodge:" in bridge.sent_messages[-1]["message"]
            await _send(
                dm,
                {
                    "type": "perform_action",
                    "sheet_id": SHADOWBLADE_INSTANCE_ID,
                    "action_id": "remove_shadow_bound",
                },
            )
            assert (
                f"condition:shadow_bound:{SHADOWBLADE_INSTANCE_ID}"
                not in reloaded.active_conditions
            )

            spawn_messages = await _send(
                dm,
                {
                    "type": "spawn_encounter_preset",
                    "encounter_id": "red_gate_scouts",
                },
            )
            assert spawn_messages[0]["type"] == "state_patch"
            assert {
                "red_gate_scouts_starter_red_gate_goblin_1",
                "red_gate_scouts_starter_red_gate_goblin_2",
                "red_gate_scouts_starter_red_gate_goblin_3",
            }.issubset(reloaded.instanced_sheets)
        finally:
            await websocket_sessions.reset()
            await chat_service.roll20_chat_bridge.reset()
            StateSingleton._state = original_state

    asyncio.run(scenario())
