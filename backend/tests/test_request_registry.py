import asyncio

import pytest
from pydantic import BaseModel

from backend.core.request_context import get_request_context
from backend.core.request_registry import (
    ClientGenerationMetadata,
    RequestRegistry,
    RequestRoute,
    request_registry,
)
from backend.features.session.models import WebSocketSession
from backend.protocol.socket import (
    ActionExecutedEvent,
    ActionFormulaAuthoringMetadataEvent,
    AuthenticateResponseEvent,
    Roll20BridgeStatusEvent,
    Roll20BridgeSyncConfigEvent,
    SheetAccessCodesEvent,
    SheetAccessClaimedEvent,
    StatePatchEvent,
    StateSnapshotEvent,
    VariableRegistryEvent,
    XpTrackerEvent,
)


def test_request_registry_exposes_registered_request_models() -> None:
    model_names = {model.__name__ for model in request_registry.request_models()}

    assert {
        "Authenticate",
        "SendRoll20ChatMessage",
        "GetRoll20BridgeStatus",
        "GetRoll20BridgeSyncConfig",
        "ResyncState",
        "PerformAction",
        "CreateAction",
        "UpdateAction",
        "DeleteAction",
        "CreateFormula",
        "UpdateFormula",
        "DeleteFormula",
        "CreateProficiency",
        "UpdateProficiency",
        "DeleteProficiency",
        "CreateItem",
        "UpdateItem",
        "DeleteItem",
        "CreateSheet",
        "UpdateSheet",
        "DeleteSheet",
        "SetSheetNotes",
        "CreateInstancedSheet",
        "DeleteInstancedSheet",
        "SetInstancedSheetUnassignedStatPoints",
        "AllocateInstancedSheetStatPoints",
        "SetInstancedSheetNotes",
        "SetInstancedSheetResource",
        "AdjustInstancedSheetResource",
        "CreateSheetActionBridge",
        "UpdateSheetActionBridge",
        "DeleteSheetActionBridge",
        "CreateSheetItemBridge",
        "UpdateSheetItemBridge",
        "DeleteSheetItemBridge",
        "CreateSheetProficiencyBridge",
        "UpdateSheetProficiencyBridge",
        "DeleteSheetProficiencyBridge",
        "SetSheetBaseStat",
        "SetSheetFormulaStat",
        "SetSheetResistances",
        "GetActionFormulaAuthoringMetadata",
        "GetVariableRegistry",
        "GenerateSheetAccessCode",
        "GetSheetAccessCodes",
        "ClaimSheetAccessCode",
        "CreateConditionPreset",
        "UpdateConditionPreset",
        "DeleteConditionPreset",
        "UpsertItemAugmentationTemplate",
        "RemoveItemAugmentationTemplate",
        "SaveEncounterPreset",
        "DeleteEncounterPreset",
        "SpawnEncounterPreset",
        "UndoLastStateChange",
    }.issubset(model_names)


def test_request_registry_exposes_deduplicated_emitted_event_models() -> None:
    emitted_models = request_registry.emitted_event_models()

    assert StateSnapshotEvent in emitted_models
    assert StatePatchEvent in emitted_models
    assert ActionExecutedEvent in emitted_models
    assert Roll20BridgeStatusEvent in emitted_models
    assert Roll20BridgeSyncConfigEvent in emitted_models
    assert ActionFormulaAuthoringMetadataEvent in emitted_models
    assert AuthenticateResponseEvent in emitted_models
    assert VariableRegistryEvent in emitted_models
    assert SheetAccessCodesEvent in emitted_models
    assert SheetAccessClaimedEvent in emitted_models
    assert emitted_models.count(StatePatchEvent) == 1


def test_every_registered_dm_route_rejects_players_and_accepts_dms() -> None:
    player_session = WebSocketSession(websocket=object(), role="player")
    dm_session = WebSocketSession(websocket=object(), role="dm")
    dm_routes = [
        route for route in request_registry.routes() if route.minimum_role == "dm"
    ]

    assert dm_routes
    for route in dm_routes:
        with pytest.raises(PermissionError):
            route.authorize(player_session)
        route.authorize(dm_session)


def test_every_registered_public_route_declares_client_generation_metadata() -> None:
    missing_metadata = [
        route.type_name
        for route in request_registry.routes()
        if route.client_generation is None
    ]

    assert missing_metadata == []


def test_request_registry_scopes_source_context_to_dispatch() -> None:
    observed_contexts = []

    class ContextRequest(BaseModel):
        type: str = "context_request"
        request_id: str | None = None
        action_id: str | None = None
        sheet_id: str | None = None

    class ContextRoute(RequestRoute[ContextRequest]):
        type_name = "context_request"
        request_model = ContextRequest
        minimum_role = "player"

        async def handle(
            self,
            session: WebSocketSession,
            request: ContextRequest,
        ) -> None:
            observed_contexts.append(get_request_context())

    async def scenario() -> None:
        registry = RequestRegistry()
        registry.register(ContextRoute())
        session = WebSocketSession(websocket=object(), role="player")

        await registry.dispatch(
            session,
            {
                "type": "context_request",
                "request_id": "request-1",
                "action_id": "action-1",
                "sheet_id": "sheet-1",
            },
        )

    asyncio.run(scenario())

    assert len(observed_contexts) == 1
    context = observed_contexts[0]
    assert context is not None
    assert context.request_id == "request-1"
    assert context.request_type == "context_request"
    assert context.action_id == "action-1"
    assert context.sheet_id == "sheet-1"
    assert get_request_context() is None


def test_request_registry_exposes_route_contracts_with_client_generation_metadata() -> None:
    contracts = {
        contract.type_name: contract for contract in request_registry.route_contracts()
    }

    assert contracts["send_roll20_chat_message"].client_generation == (
        ClientGenerationMetadata(
            namespace="chat",
            method_name="sendRoll20ChatMessage",
        )
    )
    assert contracts["get_roll20_bridge_status"].client_generation == (
        ClientGenerationMetadata(
            namespace="chat",
            method_name="getRoll20BridgeStatus",
        )
    )
    assert contracts["get_roll20_bridge_status"].emitted_event_models == (
        Roll20BridgeStatusEvent,
    )
    assert contracts["get_roll20_bridge_sync_config"].client_generation == (
        ClientGenerationMetadata(
            namespace="chat",
            method_name="getRoll20BridgeSyncConfig",
        )
    )
    assert contracts["get_roll20_bridge_sync_config"].minimum_role == "dm"
    assert contracts["get_roll20_bridge_sync_config"].emitted_event_models == (
        Roll20BridgeSyncConfigEvent,
    )
    assert contracts["save_encounter_preset"].client_generation == (
        ClientGenerationMetadata(
            namespace="encounterPresets",
            method_name="saveEncounterPreset",
        )
    )
    assert contracts["save_encounter_preset"].minimum_role == "dm"
    assert contracts["save_encounter_preset"].emitted_event_models == (
        StatePatchEvent,
    )
    assert contracts["delete_encounter_preset"].client_generation == (
        ClientGenerationMetadata(
            namespace="encounterPresets",
            method_name="deleteEncounterPreset",
        )
    )
    assert contracts["spawn_encounter_preset"].client_generation == (
        ClientGenerationMetadata(
            namespace="encounterPresets",
            method_name="spawnEncounterPreset",
        )
    )
    assert contracts["authenticate"].client_generation == ClientGenerationMetadata(
        namespace="auth",
        method_name="authenticate",
    )
    assert contracts["authenticate"].minimum_role == "unauthenticated"
    assert contracts["resync_state"].client_generation == ClientGenerationMetadata(
        namespace="stateSync",
        method_name="resyncState",
    )
    assert contracts["undo_last_state_change"].client_generation == (
        ClientGenerationMetadata(
            namespace="stateSync",
            method_name="undoLastStateChange",
        )
    )
    assert contracts["undo_last_state_change"].minimum_role == "dm"
    assert contracts["undo_last_state_change"].emitted_event_models == (
        StatePatchEvent,
    )
    assert contracts["perform_action"].client_generation == ClientGenerationMetadata(
        namespace="sheetRuntime",
        method_name="performAction",
    )
    assert contracts["perform_action"].minimum_role == "player"
    assert contracts["perform_action"].emitted_event_models == (
        ActionExecutedEvent,
        StatePatchEvent,
    )
    assert contracts["create_action"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetAdminActions",
            method_name="createAction",
        )
    )
    assert contracts["create_action"].minimum_role == "dm"
    assert contracts["create_action"].emitted_event_models == (StatePatchEvent,)
    assert contracts["update_action"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetAdminActions",
            method_name="updateAction",
        )
    )
    assert contracts["update_action"].minimum_role == "dm"
    assert contracts["delete_action"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetAdminActions",
            method_name="deleteAction",
        )
    )
    assert contracts["delete_action"].minimum_role == "dm"
    assert contracts["create_formula"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetAdminFormulas",
            method_name="createFormula",
        )
    )
    assert contracts["create_formula"].minimum_role == "dm"
    assert contracts["create_formula"].emitted_event_models == (StatePatchEvent,)
    assert contracts["update_formula"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetAdminFormulas",
            method_name="updateFormula",
        )
    )
    assert contracts["update_formula"].minimum_role == "dm"
    assert contracts["delete_formula"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetAdminFormulas",
            method_name="deleteFormula",
        )
    )
    assert contracts["delete_formula"].minimum_role == "dm"
    assert contracts["create_item"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetAdminItems",
            method_name="createItem",
        )
    )
    assert contracts["create_item"].minimum_role == "dm"
    assert contracts["create_item"].emitted_event_models == (StatePatchEvent,)
    assert contracts["update_item"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetAdminItems",
            method_name="updateItem",
        )
    )
    assert contracts["update_item"].minimum_role == "dm"
    assert contracts["delete_item"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetAdminItems",
            method_name="deleteItem",
        )
    )
    assert contracts["delete_item"].minimum_role == "dm"
    assert contracts["create_proficiency"].client_generation == (
        ClientGenerationMetadata(
            namespace="proficiencies",
            method_name="createProficiency",
        )
    )
    assert contracts["create_proficiency"].minimum_role == "dm"
    assert contracts["create_proficiency"].emitted_event_models == (StatePatchEvent,)
    assert contracts["update_proficiency"].client_generation == (
        ClientGenerationMetadata(
            namespace="proficiencies",
            method_name="updateProficiency",
        )
    )
    assert contracts["update_proficiency"].minimum_role == "dm"
    assert contracts["update_proficiency"].emitted_event_models == (StatePatchEvent,)
    assert contracts["delete_proficiency"].client_generation == (
        ClientGenerationMetadata(
            namespace="proficiencies",
            method_name="deleteProficiency",
        )
    )
    assert contracts["delete_proficiency"].minimum_role == "dm"
    assert contracts["delete_proficiency"].emitted_event_models == (StatePatchEvent,)
    assert contracts["set_sheet_base_stat"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetAdminStats",
            method_name="setSheetBaseStat",
        )
    )
    assert contracts["set_sheet_base_stat"].minimum_role == "dm"
    assert contracts["set_sheet_base_stat"].emitted_event_models == (StatePatchEvent,)
    assert contracts["set_sheet_formula_stat"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetAdminStats",
            method_name="setSheetFormulaStat",
        )
    )
    assert contracts["set_sheet_formula_stat"].minimum_role == "dm"
    assert contracts["set_sheet_formula_stat"].emitted_event_models == (StatePatchEvent,)
    assert contracts["set_sheet_resistances"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetAdminStats",
            method_name="setSheetResistances",
        )
    )
    assert contracts["set_sheet_resistances"].minimum_role == "dm"
    assert contracts["set_sheet_resistances"].emitted_event_models == (StatePatchEvent,)
    assert contracts["create_sheet"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetAdminSheets",
            method_name="createSheet",
        )
    )
    assert contracts["create_sheet"].minimum_role == "dm"
    assert contracts["create_sheet"].emitted_event_models == (StatePatchEvent,)
    assert contracts["update_sheet"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetAdminSheets",
            method_name="updateSheet",
        )
    )
    assert contracts["update_sheet"].minimum_role == "dm"
    assert contracts["update_sheet"].emitted_event_models == (StatePatchEvent,)
    assert contracts["delete_sheet"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetAdminSheets",
            method_name="deleteSheet",
        )
    )
    assert contracts["delete_sheet"].minimum_role == "dm"
    assert contracts["delete_sheet"].emitted_event_models == (StatePatchEvent,)
    assert contracts["set_sheet_notes"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetAdminNotes",
            method_name="setSheetNotes",
        )
    )
    assert contracts["set_sheet_notes"].minimum_role == "dm"
    assert contracts["set_sheet_notes"].emitted_event_models == (StatePatchEvent,)
    assert contracts["create_instanced_sheet"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetAdminSheets",
            method_name="instantiateSheet",
        )
    )
    assert contracts["create_instanced_sheet"].minimum_role == "dm"
    assert contracts["create_instanced_sheet"].emitted_event_models == (
        StatePatchEvent,
        SheetAccessCodesEvent,
    )
    assert contracts["delete_instanced_sheet"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetAdminSheets",
            method_name="deleteInstancedSheet",
        )
    )
    assert contracts["delete_instanced_sheet"].minimum_role == "dm"
    assert contracts["delete_instanced_sheet"].emitted_event_models == (
        StatePatchEvent,
        SheetAccessCodesEvent,
        XpTrackerEvent,
    )
    assert contracts["set_instanced_sheet_notes"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetInstanceNotes",
            method_name="setInstancedSheetNotes",
        )
    )
    assert contracts["set_instanced_sheet_notes"].minimum_role == "player"
    assert contracts["set_instanced_sheet_notes"].emitted_event_models == (
        StatePatchEvent,
    )
    assert contracts["set_instanced_sheet_resource"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetInstanceResources",
            method_name="setInstancedSheetResource",
        )
    )
    assert contracts["set_instanced_sheet_resource"].minimum_role == "player"
    assert contracts["set_instanced_sheet_resource"].emitted_event_models == (
        StatePatchEvent,
    )
    assert contracts["adjust_instanced_sheet_resource"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetInstanceResources",
            method_name="adjustInstancedSheetResource",
        )
    )
    assert contracts["adjust_instanced_sheet_resource"].minimum_role == "player"
    assert contracts["adjust_instanced_sheet_resource"].emitted_event_models == (
        StatePatchEvent,
    )
    assert contracts["set_instanced_sheet_unassigned_stat_points"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetInstanceStats",
            method_name="setUnassignedStatPoints",
        )
    )
    assert contracts["set_instanced_sheet_unassigned_stat_points"].minimum_role == "dm"
    assert contracts["set_instanced_sheet_unassigned_stat_points"].emitted_event_models == (
        StatePatchEvent,
    )
    assert contracts["allocate_instanced_sheet_stat_points"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetInstanceStats",
            method_name="allocateStatPoints",
        )
    )
    assert contracts["allocate_instanced_sheet_stat_points"].minimum_role == "player"
    assert contracts["allocate_instanced_sheet_stat_points"].emitted_event_models == (
        StatePatchEvent,
    )
    assert contracts["apply_instanced_sheet_damage"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetInstanceResources",
            method_name="applyInstancedSheetDamage",
        )
    )
    assert contracts["apply_instanced_sheet_damage"].minimum_role == "player"
    assert contracts["apply_instanced_sheet_damage"].emitted_event_models == (
        StatePatchEvent,
    )
    assert contracts["create_sheet_action_bridge"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetActionBridges",
            method_name="attachAction",
        )
    )
    assert contracts["create_sheet_action_bridge"].minimum_role == "dm"
    assert contracts["create_sheet_action_bridge"].emitted_event_models == (
        StatePatchEvent,
    )
    assert contracts["update_sheet_action_bridge"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetActionBridges",
            method_name="relinkAction",
        )
    )
    assert contracts["update_sheet_action_bridge"].minimum_role == "dm"
    assert contracts["update_sheet_action_bridge"].emitted_event_models == (
        StatePatchEvent,
    )
    assert contracts["delete_sheet_action_bridge"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetActionBridges",
            method_name="detachAction",
        )
    )
    assert contracts["delete_sheet_action_bridge"].minimum_role == "dm"
    assert contracts["delete_sheet_action_bridge"].emitted_event_models == (
        StatePatchEvent,
    )
    assert contracts["create_sheet_item_bridge"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetItemBridges",
            method_name="attachItem",
        )
    )
    assert contracts["create_sheet_item_bridge"].minimum_role == "dm"
    assert contracts["create_sheet_item_bridge"].emitted_event_models == (
        StatePatchEvent,
    )
    assert contracts["update_sheet_item_bridge"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetItemBridges",
            method_name="updateAttachedItem",
        )
    )
    assert contracts["update_sheet_item_bridge"].minimum_role == "dm"
    assert contracts["update_sheet_item_bridge"].emitted_event_models == (
        StatePatchEvent,
    )
    assert contracts["delete_sheet_item_bridge"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetItemBridges",
            method_name="detachItem",
        )
    )
    assert contracts["delete_sheet_item_bridge"].minimum_role == "dm"
    assert contracts["delete_sheet_item_bridge"].emitted_event_models == (
        StatePatchEvent,
    )
    assert contracts["create_sheet_proficiency_bridge"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetProficiencyBridges",
            method_name="linkProficiency",
        )
    )
    assert contracts["create_sheet_proficiency_bridge"].minimum_role == "dm"
    assert contracts["create_sheet_proficiency_bridge"].emitted_event_models == (
        StatePatchEvent,
    )
    assert contracts["update_sheet_proficiency_bridge"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetProficiencyBridges",
            method_name="updateLinkedProficiency",
        )
    )
    assert contracts["update_sheet_proficiency_bridge"].minimum_role == "dm"
    assert contracts["update_sheet_proficiency_bridge"].emitted_event_models == (
        StatePatchEvent,
    )
    assert contracts["delete_sheet_proficiency_bridge"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetProficiencyBridges",
            method_name="unlinkProficiency",
        )
    )
    assert contracts["delete_sheet_proficiency_bridge"].minimum_role == "dm"
    assert contracts["delete_sheet_proficiency_bridge"].emitted_event_models == (
        StatePatchEvent,
    )
    assert contracts["get_variable_registry"].client_generation == (
        ClientGenerationMetadata(
            namespace="variableRegistry",
            method_name="getVariableRegistry",
        )
    )
    assert contracts["get_variable_registry"].minimum_role == "player"
    assert contracts["get_variable_registry"].emitted_event_models == (
        VariableRegistryEvent,
    )
    assert contracts["get_action_formula_authoring_metadata"].client_generation == (
        ClientGenerationMetadata(
            namespace="authoringMetadata",
            method_name="getActionFormulaAuthoringMetadata",
        )
    )
    assert contracts["get_action_formula_authoring_metadata"].minimum_role == "player"
    assert contracts[
        "get_action_formula_authoring_metadata"
    ].emitted_event_models == (ActionFormulaAuthoringMetadataEvent,)
    assert contracts["generate_sheet_access_code"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetAccess",
            method_name="generateSheetAccessCode",
        )
    )
    assert contracts["generate_sheet_access_code"].minimum_role == "dm"
    assert contracts["generate_sheet_access_code"].emitted_event_models == (
        SheetAccessCodesEvent,
    )
    assert contracts["get_sheet_access_codes"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetAccess",
            method_name="getSheetAccessCodes",
        )
    )
    assert contracts["get_sheet_access_codes"].minimum_role == "dm"
    assert contracts["get_sheet_access_codes"].emitted_event_models == (
        SheetAccessCodesEvent,
    )
    assert contracts["claim_sheet_access_code"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetAccess",
            method_name="claimSheetAccessCode",
        )
    )
    assert contracts["claim_sheet_access_code"].minimum_role == "player"
    assert contracts["claim_sheet_access_code"].emitted_event_models == (
        SheetAccessClaimedEvent,
    )
    assert contracts["create_condition_preset"].client_generation == (
        ClientGenerationMetadata(
            namespace="conditionPresets",
            method_name="createConditionPreset",
        )
    )
    assert contracts["create_condition_preset"].minimum_role == "dm"
    assert contracts["create_condition_preset"].emitted_event_models == (
        StatePatchEvent,
    )
    assert contracts["update_condition_preset"].client_generation == (
        ClientGenerationMetadata(
            namespace="conditionPresets",
            method_name="updateConditionPreset",
        )
    )
    assert contracts["update_condition_preset"].minimum_role == "dm"
    assert contracts["delete_condition_preset"].client_generation == (
        ClientGenerationMetadata(
            namespace="conditionPresets",
            method_name="deleteConditionPreset",
        )
    )
    assert contracts["delete_condition_preset"].minimum_role == "dm"
    assert contracts["upsert_item_augmentation_template"].client_generation == (
        ClientGenerationMetadata(
            namespace="itemAugmentations",
            method_name="upsertItemAugmentationTemplate",
        )
    )
    assert contracts["upsert_item_augmentation_template"].minimum_role == "dm"
    assert contracts["upsert_item_augmentation_template"].emitted_event_models == (
        StatePatchEvent,
    )
    assert contracts["remove_item_augmentation_template"].client_generation == (
        ClientGenerationMetadata(
            namespace="itemAugmentations",
            method_name="removeItemAugmentationTemplate",
        )
    )
    assert contracts["remove_item_augmentation_template"].minimum_role == "dm"


def test_request_registry_rejects_duplicate_client_generation_metadata() -> None:
    class DuplicateRequest(BaseModel):
        type: str = "duplicate_request"

    class DuplicateRoute(RequestRoute[DuplicateRequest]):
        type_name = "duplicate_request"
        request_model = DuplicateRequest
        client_generation = ClientGenerationMetadata(
            namespace="chat",
            method_name="sendRoll20ChatMessage",
        )

        async def handle(self, session, request: DuplicateRequest) -> None:
            raise NotImplementedError

    registry = RequestRegistry()
    for route in request_registry.routes():
        registry.register(route)

    try:
        registry.register(DuplicateRoute())
    except ValueError as exc:
        assert str(exc) == (
            "Client generation metadata already registered for "
            "chat.sendRoll20ChatMessage."
        )
    else:
        raise AssertionError("Expected duplicate client-generation metadata to fail.")
