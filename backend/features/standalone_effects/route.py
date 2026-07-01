from backend.core.request_registry import (
    ClientGenerationMetadata,
    RequestRegistry,
    RequestRoute,
)
from backend.features.session.models import WebSocketSession
from backend.features.standalone_effects import service
from backend.features.standalone_effects.schema import (
    CreateStandaloneEffect,
    DeleteStandaloneEffect,
    UpdateStandaloneEffect,
)
from backend.protocol.socket import StatePatchEvent


class CreateStandaloneEffectRoute(RequestRoute[CreateStandaloneEffect]):
    type_name = "create_standalone_effect"
    request_model = CreateStandaloneEffect
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="standaloneEffects",
        method_name="createStandaloneEffect",
    )

    async def handle(
        self, session: WebSocketSession, request: CreateStandaloneEffect
    ) -> None:
        await service.create_standalone_effect(request)


class UpdateStandaloneEffectRoute(RequestRoute[UpdateStandaloneEffect]):
    type_name = "update_standalone_effect"
    request_model = UpdateStandaloneEffect
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="standaloneEffects",
        method_name="updateStandaloneEffect",
    )

    async def handle(
        self, session: WebSocketSession, request: UpdateStandaloneEffect
    ) -> None:
        await service.update_standalone_effect(request)


class DeleteStandaloneEffectRoute(RequestRoute[DeleteStandaloneEffect]):
    type_name = "delete_standalone_effect"
    request_model = DeleteStandaloneEffect
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="standaloneEffects",
        method_name="deleteStandaloneEffect",
    )

    async def handle(
        self, session: WebSocketSession, request: DeleteStandaloneEffect
    ) -> None:
        await service.delete_standalone_effect(request)


def register_routes(registry: RequestRegistry) -> None:
    registry.register(CreateStandaloneEffectRoute())
    registry.register(UpdateStandaloneEffectRoute())
    registry.register(DeleteStandaloneEffectRoute())
