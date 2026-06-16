from backend.core.request_registry import (
    ClientGenerationMetadata,
    RequestRegistry,
    RequestRoute,
)
from backend.features.session.models import WebSocketSession
from backend.features.sheet_admin.actions import service
from backend.features.sheet_admin.actions.schema import (
    CreateAction,
    DeleteAction,
    UpdateAction,
)
from backend.protocol.socket import StatePatchEvent


class CreateActionRoute(RequestRoute[CreateAction]):
    type_name = "create_action"
    request_model = CreateAction
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="sheetAdminActions",
        method_name="createAction",
    )

    async def handle(self, session: WebSocketSession, request: CreateAction) -> None:
        await service.create_typed_action(request)


class UpdateActionRoute(RequestRoute[UpdateAction]):
    type_name = "update_action"
    request_model = UpdateAction
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="sheetAdminActions",
        method_name="updateAction",
    )

    async def handle(self, session: WebSocketSession, request: UpdateAction) -> None:
        await service.update_typed_action(request)


class DeleteActionRoute(RequestRoute[DeleteAction]):
    type_name = "delete_action"
    request_model = DeleteAction
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="sheetAdminActions",
        method_name="deleteAction",
    )

    async def handle(self, session: WebSocketSession, request: DeleteAction) -> None:
        await service.delete_typed_action(request)


def register_routes(registry: RequestRegistry) -> None:
    registry.register(CreateActionRoute())
    registry.register(UpdateActionRoute())
    registry.register(DeleteActionRoute())
