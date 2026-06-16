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
        "SetSheetBaseStat",
        "SetSheetFormulaStat",
        "GetVariableRegistry",
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
