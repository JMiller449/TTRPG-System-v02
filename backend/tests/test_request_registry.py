from pydantic import BaseModel

from backend.core.request_registry import (
    ClientGenerationMetadata,
    RequestRegistry,
    RequestRoute,
    request_registry,
)
from backend.protocol.socket import (
    ActionExecutedEvent,
    AuthenticateResponseEvent,
    SheetAccessCodesEvent,
    StatePatchEvent,
    StateSnapshotEvent,
    VariableRegistryEvent,
)


def test_request_registry_exposes_registered_request_models() -> None:
    model_names = {model.__name__ for model in request_registry.request_models()}

    assert {
        "Authenticate",
        "SendRoll20ChatMessage",
        "ResyncState",
        "PerformAction",
        "CreateAction",
        "UpdateAction",
        "DeleteAction",
        "CreateFormula",
        "UpdateFormula",
        "DeleteFormula",
        "CreateItem",
        "UpdateItem",
        "DeleteItem",
        "CreateSheet",
        "UpdateSheet",
        "DeleteSheet",
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
        "GetVariableRegistry",
        "GenerateSheetAccessCode",
        "GetSheetAccessCodes",
        "CreateConditionPreset",
        "UpdateConditionPreset",
        "DeleteConditionPreset",
        "UpsertItemAugmentationTemplate",
        "RemoveItemAugmentationTemplate",
    }.issubset(model_names)


def test_request_registry_exposes_deduplicated_emitted_event_models() -> None:
    emitted_models = request_registry.emitted_event_models()

    assert StateSnapshotEvent in emitted_models
    assert StatePatchEvent in emitted_models
    assert ActionExecutedEvent in emitted_models
    assert AuthenticateResponseEvent in emitted_models
    assert VariableRegistryEvent in emitted_models
    assert SheetAccessCodesEvent in emitted_models
    assert emitted_models.count(StatePatchEvent) == 1


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
    assert contracts["authenticate"].client_generation == ClientGenerationMetadata(
        namespace="auth",
        method_name="authenticate",
    )
    assert contracts["authenticate"].minimum_role == "unauthenticated"
    assert contracts["resync_state"].client_generation == ClientGenerationMetadata(
        namespace="stateSync",
        method_name="resyncState",
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
    assert contracts["create_sheet_action_bridge"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetActionBridges",
            method_name="createSheetActionBridge",
        )
    )
    assert contracts["create_sheet_action_bridge"].minimum_role == "dm"
    assert contracts["create_sheet_action_bridge"].emitted_event_models == (
        StatePatchEvent,
    )
    assert contracts["update_sheet_action_bridge"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetActionBridges",
            method_name="updateSheetActionBridge",
        )
    )
    assert contracts["update_sheet_action_bridge"].minimum_role == "dm"
    assert contracts["delete_sheet_action_bridge"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetActionBridges",
            method_name="deleteSheetActionBridge",
        )
    )
    assert contracts["delete_sheet_action_bridge"].minimum_role == "dm"
    assert contracts["create_sheet_item_bridge"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetItemBridges",
            method_name="createSheetItemBridge",
        )
    )
    assert contracts["create_sheet_item_bridge"].minimum_role == "dm"
    assert contracts["create_sheet_item_bridge"].emitted_event_models == (
        StatePatchEvent,
    )
    assert contracts["update_sheet_item_bridge"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetItemBridges",
            method_name="updateSheetItemBridge",
        )
    )
    assert contracts["update_sheet_item_bridge"].minimum_role == "dm"
    assert contracts["delete_sheet_item_bridge"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetItemBridges",
            method_name="deleteSheetItemBridge",
        )
    )
    assert contracts["delete_sheet_item_bridge"].minimum_role == "dm"
    assert contracts["create_sheet_proficiency_bridge"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetProficiencyBridges",
            method_name="createSheetProficiencyBridge",
        )
    )
    assert contracts["create_sheet_proficiency_bridge"].minimum_role == "dm"
    assert contracts["create_sheet_proficiency_bridge"].emitted_event_models == (
        StatePatchEvent,
    )
    assert contracts["update_sheet_proficiency_bridge"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetProficiencyBridges",
            method_name="updateSheetProficiencyBridge",
        )
    )
    assert contracts["update_sheet_proficiency_bridge"].minimum_role == "dm"
    assert contracts["delete_sheet_proficiency_bridge"].client_generation == (
        ClientGenerationMetadata(
            namespace="sheetProficiencyBridges",
            method_name="deleteSheetProficiencyBridge",
        )
    )
    assert contracts["delete_sheet_proficiency_bridge"].minimum_role == "dm"
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
