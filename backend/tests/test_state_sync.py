import asyncio
from copy import deepcopy
from dataclasses import asdict

import pytest

from backend.features.state_sync import handler as state_sync_handler
from backend.features.state_sync.schema import PatchOp, ResyncState
from backend.features.session.service import websocket_sessions
from backend.features.state_sync.service import (
    DuplicateRequestError,
    StateSyncService,
    state_sync_service,
)
from backend.state.models.augmentation import (
    Augmentation,
    AugmentationSource,
    AugmentationTarget,
    FormulaModifierEffect,
)
from backend.state.models.formula import Formula
from backend.state.models.attribute import synchronize_required_sheet_attributes
from backend.state.models.condition import ActiveCondition, ConditionPreset
from backend.state.models.sheet import InstancedSheet, Sheet
from backend.state.models.state import State
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


def test_duplicate_request_id_does_not_repeat_state_mutation(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            StateSingleton.getState().sheets["mage_template"] = _build_sheet_state()
            await websocket_sessions.reset()
            await state_sync_service.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await state_sync_service.increment(
                "/sheets/mage_template/stats/strength",
                2,
                request_id="retry-1",
            )
            with pytest.raises(DuplicateRequestError, match="already processed"):
                await state_sync_service.increment(
                    "/sheets/mage_template/stats/strength",
                    2,
                    request_id="retry-1",
                )

            assert StateSingleton.getState().sheets["mage_template"].stats.strength == 12
            assert state_sync_service.current_version == 1
            assert len(websocket.sent_messages) == 1
            assert websocket.sent_messages[0]["request_id"] == "retry-1"
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_processed_request_cache_evicts_oldest_id_at_its_limit() -> None:
    async def scenario() -> None:
        service = StateSyncService(processed_request_limit=2)
        mutation_count = 0

        def mutation(state: State) -> tuple[None, list[PatchOp]]:
            nonlocal mutation_count
            mutation_count += 1
            return None, []

        await service.apply_mutation(mutation, request_id="request-1")
        await service.apply_mutation(mutation, request_id="request-2")
        with pytest.raises(DuplicateRequestError):
            await service.apply_mutation(mutation, request_id="request-1")

        await service.apply_mutation(mutation, request_id="request-3")
        await service.apply_mutation(mutation, request_id="request-1")

        assert mutation_count == 4

    asyncio.run(scenario())


def test_mutation_audit_evicts_oldest_entry_at_its_limit(monkeypatch) -> None:
    async def scenario() -> None:
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        await websocket_sessions.reset()
        service = StateSyncService(mutation_audit_limit=2)

        for index in range(3):
            op = PatchOp(op="set", path=f"/audit/{index}", value=index)
            await service.apply_mutation(
                lambda state, op=op: (None, [op]),
                request_id=f"request-{index}",
            )

        audit_entries = await service.recent_mutations()
        assert [entry.state_version for entry in audit_entries] == [2, 3]
        assert [entry.request_id for entry in audit_entries] == [
            "request-1",
            "request-2",
        ]
        assert [entry.paths for entry in audit_entries] == [
            ("/audit/1",),
            ("/audit/2",),
        ]

    asyncio.run(scenario())


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
                "lifting": {
                    "aliases": [{"name": "strength", "path": ["strength"]}],
                    "text": "@strength * 2",
                },
                "carry_weight": {
                    "aliases": [{"name": "strength", "path": ["strength"]}],
                    "text": "@strength * 3",
                },
                "acrobatics": {
                    "aliases": [{"name": "dexterity", "path": ["dexterity"]}],
                    "text": "@dexterity",
                },
                "stamina": {
                    "aliases": [{"name": "constitution", "path": ["constitution"]}],
                    "text": "@constitution",
                },
                "reaction_time": {
                    "aliases": [{"name": "dexterity", "path": ["dexterity"]}],
                    "text": "@dexterity",
                },
                "health": {
                    "aliases": [{"name": "constitution", "path": ["constitution"]}],
                    "text": "@constitution * 10",
                },
                "endurance": {
                    "aliases": [{"name": "constitution", "path": ["constitution"]}],
                    "text": "@constitution * 2",
                },
                "pain_tolerance": {
                    "aliases": [{"name": "will", "path": ["will"]}],
                    "text": "@will",
                },
                "sight_distance": {
                    "aliases": [{"name": "perception", "path": ["perception"]}],
                    "text": "@perception * 4",
                },
                "intuition": {
                    "aliases": [{"name": "perception", "path": ["perception"]}],
                    "text": "@perception",
                },
                "registration": {
                    "aliases": [{"name": "arcane", "path": ["arcane"]}],
                    "text": "@arcane",
                },
                "mana": {
                    "aliases": [{"name": "arcane", "path": ["arcane"]}],
                    "text": "@arcane * 8",
                },
                "control": {
                    "aliases": [{"name": "arcane", "path": ["arcane"]}],
                    "text": "@arcane",
                },
                "sensitivity": {
                    "aliases": [{"name": "arcane", "path": ["arcane"]}],
                    "text": "@arcane",
                },
                "charisma": {
                    "aliases": [{"name": "will", "path": ["will"]}],
                    "text": "@will",
                },
                "mental_fortitude": {
                    "aliases": [{"name": "will", "path": ["will"]}],
                    "text": "@will * 2",
                },
                "courage": {
                    "aliases": [{"name": "will", "path": ["will"]}],
                    "text": "@will",
                },
            },
            "slayed_record": {},
            "actions": {},
        }
    )
    synchronize_required_sheet_attributes(sheet)
    return sheet


def _build_augmentation() -> Augmentation:
    return Augmentation(
        id="aug-1",
        name="Flame Brand",
        description="Adds fire damage to weapon attacks.",
        source=AugmentationSource(
            type="item",
            id="flame_brand",
            label="Flame Brand",
        ),
        scope="instance",
        target=AugmentationTarget(
            root="instance",
            path=["weapon_damage_bonus"],
        ),
        effect=FormulaModifierEffect(
            operation="add",
            value=Formula(
                aliases=None,
                text="5",
            ),
        ),
    )


def test_state_round_trips_sheet_and_instance_resistances() -> None:
    sheet = asdict(_build_sheet_state())
    sheet["notes"] = "GM template notes."
    sheet["resistances"] = {
        "resistance": 0.1,
        "physical": 0.2,
        "fire": 0.3,
    }
    state = State.from_dict(
        {
            "sheets": {
                "mage_template": sheet,
            },
            "instanced_sheets": {
                "mage_instance": {
                    "parent_id": "mage_template",
                    "notes": "Player instance notes.",
                    "health": 100,
                    "mana": 20,
                    "resistances": {
                        "resistance": 0.05,
                        "magical": 0.25,
                        "fire": 0.4,
                    },
                    "augments": {},
                },
                "legacy_instance": {
                    "parent_id": "mage_template",
                    "health": 90,
                    "mana": 10,
                    "augments": {},
                },
            },
        }
    )

    assert state.sheets["mage_template"].resistances.resistance == 0.1
    assert state.sheets["mage_template"].notes == "GM template notes."
    assert state.sheets["mage_template"].resistances.physical == 0.2
    assert state.sheets["mage_template"].resistances.fire == 0.3
    assert state.instanced_sheets["mage_instance"].resistances.resistance == 0.05
    assert state.instanced_sheets["mage_instance"].notes == "Player instance notes."
    assert state.instanced_sheets["mage_instance"].resistances.magical == 0.25
    assert state.instanced_sheets["mage_instance"].resistances.fire == 0.4
    assert state.instanced_sheets["legacy_instance"].resistances.fire == 0.0
    assert state.instanced_sheets["legacy_instance"].notes == ""


def test_player_snapshot_redacts_template_notes_but_keeps_instance_notes(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            sheet = _build_sheet_state()
            sheet.notes = "GM-only template notes."
            state = StateSingleton.getState()
            state.sheets["mage_template"] = sheet
            state.instanced_sheets["mage_instance"] = InstancedSheet.from_dict(
                {
                    "parent_id": "mage_template",
                    "notes": "Shared instance notes.",
                    "health": 100,
                    "mana": 20,
                    "resistances": {},
                    "augments": {},
                }
            )

            player_snapshot = await state_sync_service.snapshot(role="player")
            dm_snapshot = await state_sync_service.snapshot(role="dm")

            assert "notes" not in player_snapshot.state["sheets"]["mage_template"]
            assert player_snapshot.state["instanced_sheets"]["mage_instance"][
                "notes"
            ] == "Shared instance notes."
            assert (
                dm_snapshot.state["sheets"]["mage_template"]["notes"]
                == "GM-only template notes."
            )
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_active_condition_snapshots_respect_visibility_and_assignment(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.condition_presets = {
                "public": ConditionPreset(id="public", name="Public"),
                "hidden": ConditionPreset(
                    id="hidden",
                    name="Hidden",
                    visibility="gm_only",
                ),
            }
            state.active_conditions = {
                "public-one": ActiveCondition(
                    application_id="public-one",
                    condition_id="public",
                    condition_name="Public",
                    description="Visible status.",
                    visibility="public",
                    instance_id="instance-1",
                ),
                "hidden-one": ActiveCondition(
                    application_id="hidden-one",
                    condition_id="hidden",
                    condition_name="Hidden",
                    description="Secret status.",
                    visibility="gm_only",
                    instance_id="instance-1",
                ),
                "public-two": ActiveCondition(
                    application_id="public-two",
                    condition_id="public",
                    condition_name="Public",
                    description="Other player status.",
                    visibility="public",
                    instance_id="instance-2",
                ),
            }

            player_snapshot = await state_sync_service.snapshot(
                role="player",
                assigned_instance_id="instance-1",
            )
            dm_snapshot = await state_sync_service.snapshot(role="dm")

            assert set(player_snapshot.state["condition_presets"]) == {"public"}
            assert set(player_snapshot.state["active_conditions"]) == {"public-one"}
            assert set(dm_snapshot.state["active_conditions"]) == {
                "public-one",
                "hidden-one",
                "public-two",
            }
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_active_condition_patches_are_filtered_per_player_assignment(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await websocket_sessions.reset()
            dm_socket = FakeWebSocket()
            player_one_socket = FakeWebSocket()
            player_two_socket = FakeWebSocket()
            await websocket_sessions.connect(dm_socket, role="dm")
            await websocket_sessions.connect(player_one_socket, role="player")
            await websocket_sessions.assign_player_sheet(
                player_one_socket,
                sheet_id="sheet-1",
                instance_id="instance-1",
            )
            await websocket_sessions.connect(player_two_socket, role="player")
            await websocket_sessions.assign_player_sheet(
                player_two_socket,
                sheet_id="sheet-2",
                instance_id="instance-2",
            )

            await state_sync_service.add(
                "/active_conditions/public-one",
                ActiveCondition(
                    application_id="public-one",
                    condition_id="public",
                    condition_name="Public",
                    description="Visible status.",
                    visibility="public",
                    instance_id="instance-1",
                ),
            )
            await state_sync_service.add(
                "/active_conditions/hidden-one",
                ActiveCondition(
                    application_id="hidden-one",
                    condition_id="hidden",
                    condition_name="Hidden",
                    description="Secret status.",
                    visibility="gm_only",
                    instance_id="instance-1",
                ),
            )

            assert dm_socket.sent_messages[0]["ops"][0]["path"] == (
                "/active_conditions/public-one"
            )
            assert player_one_socket.sent_messages[0]["ops"][0]["path"] == (
                "/active_conditions/public-one"
            )
            assert player_two_socket.sent_messages[0]["ops"] == []
            assert player_one_socket.sent_messages[1]["ops"] == []
            assert player_two_socket.sent_messages[1]["ops"] == []
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_template_note_patch_is_redacted_for_players(monkeypatch) -> None:
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

            await state_sync_service.set(
                "/sheets/mage_template/notes",
                "GM-only template notes.",
                request_id="req-1",
            )

            assert dm_socket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "set",
                            "path": "/sheets/mage_template/notes",
                            "value": "GM-only template notes.",
                        }
                    ],
                    "state_version": 1,
                    "type": "state_patch",
                    "request_id": "req-1",
                }
            ]
            assert player_socket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [],
                    "state_version": 1,
                    "type": "state_patch",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_sheet_payload_patch_redacts_template_notes_for_players(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await websocket_sessions.reset()
            dm_socket = FakeWebSocket()
            player_socket = FakeWebSocket()
            await websocket_sessions.connect(dm_socket, role="dm")
            await websocket_sessions.connect(player_socket, role="player")

            sheet = _build_sheet_state()
            sheet.notes = "GM-only template notes."
            await state_sync_service.add(
                "/sheets/mage_template",
                sheet,
                request_id="req-1",
            )

            assert dm_socket.sent_messages[0]["ops"][0]["value"]["notes"] == (
                "GM-only template notes."
            )
            assert "notes" not in player_socket.sent_messages[0]["ops"][0]["value"]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_replayed_template_note_patch_is_redacted_for_players(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            StateSingleton.getState().sheets["mage_template"] = _build_sheet_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            session = await websocket_sessions.connect(websocket, role="player")

            await state_sync_service.set(
                "/sheets/mage_template/notes",
                "GM-only template notes.",
                request_id="req-1",
            )
            websocket.sent_messages.clear()

            await state_sync_handler.handle_request(
                session,
                ResyncState(
                    type="resync_state",
                    last_seen_version=0,
                    request_id="req-2",
                ),
            )

            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [],
                    "state_version": 1,
                    "type": "state_patch",
                    "request_id": "req-2",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_state_sync_can_patch_top_level_augmentation_root(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await state_sync_service.add(
                "/augmentations/aug-1",
                _build_augmentation(),
                request_id="req-1",
            )

            assert "aug-1" in StateSingleton.getState().augmentations
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "add",
                            "path": "/augmentations/aug-1",
                            "value": {
                                "id": "aug-1",
                                "name": "Flame Brand",
                                "source": {
                                    "type": "item",
                                    "id": "flame_brand",
                                    "label": "Flame Brand",
                                    "relationship_id": None,
                                    "application_id": None,
                                },
                                "scope": "instance",
                                "target": {
                                    "root": "instance",
                                    "path": ["weapon_damage_bonus"],
                                },
                                "effect": {
                                    "operation": "add",
                                    "value": {
                                        "aliases": None,
                                        "text": "5",
                                        "tags": [],
                                    },
                                    "selector": {
                                        "required_tags": [],
                                        "excluded_tags": [],
                                        "action_id": None,
                                        "formula_id": None,
                                        "step_id": None,
                                        "same_source_item": False,
                                    },
                                    "type": "formula_modifier",
                                },
                                "description": "Adds fire damage to weapon attacks.",
                                "active": True,
                                "applied": False,
                                "applied_target_id": None,
                                "lifecycle_owner": "manual",
                                "lifecycle": {
                                    "duration": None,
                                    "expires_at": None,
                                    "removal_condition": None,
                                },
                            },
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

            await state_sync_service.increment(
                "/sheets/mage_template/stats/strength", 2, request_id="req-1"
            )
            await state_sync_service.decrement(
                "/sheets/mage_template/stats/strength", 1, request_id="req-2"
            )

            assert (
                StateSingleton.getState().sheets["mage_template"].stats.strength == 11
            )
            assert [message["ops"][0]["value"] for message in dm_socket.sent_messages] == [
                2,
                -1,
            ]
            assert [
                message["ops"][1]["path"] for message in dm_socket.sent_messages
            ] == [
                "/sheets/mage_template/evaluated_stats",
                "/sheets/mage_template/evaluated_stats",
            ]
            assert [
                message["ops"][1]["value"]["strength"]
                for message in dm_socket.sent_messages
            ] == [12, 11]
            assert player_socket.sent_messages == dm_socket.sent_messages
            assert [
                (
                    record.state_version,
                    record.request_id,
                    record.request_type,
                    record.operation_paths,
                )
                for record in state_sync_service.mutation_history
            ] == [
                (
                    1,
                    "req-1",
                    None,
                    (
                        "/sheets/mage_template/stats/strength",
                        "/sheets/mage_template/evaluated_stats",
                    ),
                ),
                (
                    2,
                    "req-2",
                    None,
                    (
                        "/sheets/mage_template/stats/strength",
                        "/sheets/mage_template/evaluated_stats",
                    ),
                ),
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_state_sync_undo_reverses_last_mutation_and_broadcasts_patch(monkeypatch) -> None:
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

            await state_sync_service.increment(
                "/sheets/mage_template/stats/strength", 2, request_id="req-1"
            )
            undone = await state_sync_service.undo_last_change(request_id="req-undo")

            assert undone is True
            assert (
                StateSingleton.getState().sheets["mage_template"].stats.strength == 10
            )
            assert state_sync_service.undo_depth == 0
            assert [message["ops"][0]["value"] for message in dm_socket.sent_messages] == [
                2,
                -2,
            ]
            assert [
                message["ops"][1]["value"]["strength"]
                for message in dm_socket.sent_messages
            ] == [12, 10]
            assert player_socket.sent_messages == dm_socket.sent_messages
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_state_sync_undo_restores_set_remove_and_add_mutations(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.sheets["mage_template"] = _build_sheet_state()

            await state_sync_service.set(
                "/sheets/mage_template/name", "Renamed Mage", request_id="req-set"
            )
            await state_sync_service.undo_last_change(request_id="req-undo-set")
            assert state.sheets["mage_template"].name == "Mage Template"

            await state_sync_service.remove(
                "/sheets/mage_template", request_id="req-remove"
            )
            assert "mage_template" not in state.sheets
            await state_sync_service.undo_last_change(request_id="req-undo-remove")
            assert state.sheets["mage_template"].name == "Mage Template"

            await state_sync_service.add(
                "/sheets/temporary_template",
                _build_sheet_state(),
                request_id="req-add",
            )
            assert "temporary_template" in state.sheets
            await state_sync_service.undo_last_change(request_id="req-undo-add")
            assert "temporary_template" not in state.sheets
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_state_sync_undo_returns_false_when_history_is_empty() -> None:
    assert asyncio.run(state_sync_service.undo_last_change(request_id="req-undo")) is False


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

            await state_sync_service.increment(
                "/sheets/mage_template/stats/strength", 2, request_id="req-1"
            )
            await state_sync_service.decrement(
                "/sheets/mage_template/stats/strength", 1, request_id="req-2"
            )
            websocket.sent_messages.clear()

            await state_sync_handler.handle_request(
                session,
                ResyncState(
                    type="resync_state",
                    last_seen_version=0,
                    request_id="req-3",
                ),
            )

            assert [message["ops"][0]["value"] for message in websocket.sent_messages] == [
                2,
                -1,
            ]
            assert [
                message["ops"][1]["value"]["strength"]
                for message in websocket.sent_messages
            ] == [12, 11]
            assert all(
                message["request_id"] == "req-3" for message in websocket.sent_messages
            )
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

            await state_sync_service.increment(
                "/sheets/mage_template/stats/strength", 2, request_id="req-1"
            )
            websocket.sent_messages.clear()

            await state_sync_handler.handle_request(
                session,
                ResyncState(
                    type="resync_state",
                    last_seen_version=99,
                    request_id="req-2",
                ),
            )

            expected_state = StateSingleton.getState().to_dict()
            expected_state["sheets"]["mage_template"]["xp_given_when_slayed"] = 0
            expected_state["sheets"]["mage_template"]["xp_cap"] = ""
            expected_state["sheets"]["mage_template"]["evaluated_stats"] = {
                "strength": 12,
                "dexterity": 11,
                "constitution": 12,
                "perception": 13,
                "arcane": 14,
                "will": 15,
            }
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "state": expected_state,
                    "state_version": 1,
                    "type": "state_snapshot",
                    "request_id": "req-2",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())
