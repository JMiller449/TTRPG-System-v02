from backend.core.request_registry import RequestRegistry, RequestRoute
from backend.features.session.models import WebSocketSession
from backend.features.sheet_admin import handler
from backend.features.sheet_admin.shared.schema import (
    CreateEntity,
    DeleteEntity,
    UpdateEntity,
)
from backend.protocol.socket import StatePatchEvent


class CreateEntityRoute(RequestRoute[CreateEntity]):
    type_name = "create_entity"
    request_model = CreateEntity
    emitted_event_models = (StatePatchEvent,)
    requires_dm = True
    permission_denied_reason = (
        "Sheet admin mutations require an authenticated DM session."
    )

    async def handle(self, session: WebSocketSession, request: CreateEntity) -> None:
        await handler.handle_request(session, request)


class UpdateEntityRoute(RequestRoute[UpdateEntity]):
    type_name = "update_entity"
    request_model = UpdateEntity
    emitted_event_models = (StatePatchEvent,)
    requires_dm = True
    permission_denied_reason = (
        "Sheet admin mutations require an authenticated DM session."
    )

    async def handle(self, session: WebSocketSession, request: UpdateEntity) -> None:
        await handler.handle_request(session, request)


class DeleteEntityRoute(RequestRoute[DeleteEntity]):
    type_name = "delete_entity"
    request_model = DeleteEntity
    emitted_event_models = (StatePatchEvent,)
    requires_dm = True
    permission_denied_reason = (
        "Sheet admin mutations require an authenticated DM session."
    )

    async def handle(self, session: WebSocketSession, request: DeleteEntity) -> None:
        await handler.handle_request(session, request)


def register_routes(registry: RequestRegistry) -> None:
    registry.register(CreateEntityRoute())
    registry.register(UpdateEntityRoute())
    registry.register(DeleteEntityRoute())
