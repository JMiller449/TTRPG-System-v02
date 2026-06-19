from backend.core.request_registry import (
    ClientGenerationMetadata,
    RequestRegistry,
    RequestRoute,
)
from backend.features.session.models import WebSocketSession
from backend.features.variable_registry import handler
from backend.features.variable_registry.schema import (
    GetActionFormulaAuthoringMetadata,
    GetAugmentationTargetMetadata,
    GetVariableRegistry,
)
from backend.protocol.socket import (
    ActionFormulaAuthoringMetadataEvent,
    AugmentationTargetMetadataEvent,
    VariableRegistryEvent,
)


class GetVariableRegistryRoute(RequestRoute[GetVariableRegistry]):
    type_name = "get_variable_registry"
    request_model = GetVariableRegistry
    emitted_event_models = (VariableRegistryEvent,)
    minimum_role = "player"
    client_generation = ClientGenerationMetadata(
        namespace="variableRegistry",
        method_name="getVariableRegistry",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: GetVariableRegistry,
    ) -> None:
        await handler.handle_request(session, request)


class GetActionFormulaAuthoringMetadataRoute(
    RequestRoute[GetActionFormulaAuthoringMetadata]
):
    type_name = "get_action_formula_authoring_metadata"
    request_model = GetActionFormulaAuthoringMetadata
    emitted_event_models = (ActionFormulaAuthoringMetadataEvent,)
    minimum_role = "player"
    client_generation = ClientGenerationMetadata(
        namespace="authoringMetadata",
        method_name="getActionFormulaAuthoringMetadata",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: GetActionFormulaAuthoringMetadata,
    ) -> None:
        await handler.handle_authoring_metadata_request(session, request)


class GetAugmentationTargetMetadataRoute(RequestRoute[GetAugmentationTargetMetadata]):
    type_name = "get_augmentation_target_metadata"
    request_model = GetAugmentationTargetMetadata
    emitted_event_models = (AugmentationTargetMetadataEvent,)
    minimum_role = "player"
    client_generation = ClientGenerationMetadata(
        namespace="authoringMetadata",
        method_name="getAugmentationTargetMetadata",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: GetAugmentationTargetMetadata,
    ) -> None:
        await handler.handle_augmentation_target_metadata_request(session, request)


def register_routes(registry: RequestRegistry) -> None:
    registry.register(GetVariableRegistryRoute())
    registry.register(GetActionFormulaAuthoringMetadataRoute())
    registry.register(GetAugmentationTargetMetadataRoute())
