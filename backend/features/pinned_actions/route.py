from backend.core.request_registry import ClientGenerationMetadata, RequestRegistry, RequestRoute
from backend.features.pinned_actions import service
from backend.features.pinned_actions.schema import SetPinnedInstanceActions
from backend.features.session.models import WebSocketSession
from backend.features.sheet_access import service as sheet_access_service
from backend.protocol.socket import StatePatchEvent


class SetPinnedInstanceActionsRoute(RequestRoute[SetPinnedInstanceActions]):
    type_name = "set_pinned_instance_actions"
    request_model = SetPinnedInstanceActions
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "player"
    client_generation = ClientGenerationMetadata(
        namespace="pinnedActions", method_name="setPinnedActions"
    )

    async def handle(
        self, session: WebSocketSession, request: SetPinnedInstanceActions
    ) -> None:
        sheet_access_service.ensure_session_can_access_instance(session, request.instance_id)
        await service.set_pinned_instance_actions(request)


def register_routes(registry: RequestRegistry) -> None:
    registry.register(SetPinnedInstanceActionsRoute())
