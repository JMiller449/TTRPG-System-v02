from backend.core.request_registry import (
    ClientGenerationMetadata,
    RequestRegistry,
    RequestRoute,
)
from backend.features.session.models import WebSocketSession
from backend.features.sheet_admin.tags import service
from backend.features.sheet_admin.tags.schema import CreateTag, DeleteTag, UpdateTag
from backend.protocol.socket import StatePatchEvent


class CreateTagRoute(RequestRoute[CreateTag]):
    type_name = "create_tag"
    request_model = CreateTag
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="tags",
        method_name="createTag",
    )

    async def handle(self, session: WebSocketSession, request: CreateTag) -> None:
        await service.create_tag(request)


class UpdateTagRoute(RequestRoute[UpdateTag]):
    type_name = "update_tag"
    request_model = UpdateTag
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="tags",
        method_name="updateTag",
    )

    async def handle(self, session: WebSocketSession, request: UpdateTag) -> None:
        await service.update_tag(request)


class DeleteTagRoute(RequestRoute[DeleteTag]):
    type_name = "delete_tag"
    request_model = DeleteTag
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="tags",
        method_name="deleteTag",
    )

    async def handle(self, session: WebSocketSession, request: DeleteTag) -> None:
        await service.delete_tag(request)


def register_routes(registry: RequestRegistry) -> None:
    registry.register(CreateTagRoute())
    registry.register(UpdateTagRoute())
    registry.register(DeleteTagRoute())
