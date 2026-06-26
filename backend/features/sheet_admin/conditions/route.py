from backend.core.request_registry import (
    ClientGenerationMetadata,
    RequestRegistry,
    RequestRoute,
)
from backend.features.session.models import WebSocketSession
from backend.features.sheet_admin.conditions import service
from backend.features.sheet_admin.conditions.schema import (
    CreateConditionPreset,
    DeleteConditionPreset,
    UpdateConditionPreset,
)
from backend.protocol.socket import StatePatchEvent


class CreateConditionPresetRoute(RequestRoute[CreateConditionPreset]):
    type_name = "create_condition_preset"
    request_model = CreateConditionPreset
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="conditionPresets",
        method_name="createConditionPreset",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: CreateConditionPreset,
    ) -> None:
        await service.create_condition_preset(request)


class UpdateConditionPresetRoute(RequestRoute[UpdateConditionPreset]):
    type_name = "update_condition_preset"
    request_model = UpdateConditionPreset
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="conditionPresets",
        method_name="updateConditionPreset",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: UpdateConditionPreset,
    ) -> None:
        await service.update_condition_preset(request)


class DeleteConditionPresetRoute(RequestRoute[DeleteConditionPreset]):
    type_name = "delete_condition_preset"
    request_model = DeleteConditionPreset
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="conditionPresets",
        method_name="deleteConditionPreset",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: DeleteConditionPreset,
    ) -> None:
        await service.delete_condition_preset(request)


def register_routes(registry: RequestRegistry) -> None:
    registry.register(CreateConditionPresetRoute())
    registry.register(UpdateConditionPresetRoute())
    registry.register(DeleteConditionPresetRoute())
