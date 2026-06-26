from backend.core.request_registry import (
    ClientGenerationMetadata,
    RequestRegistry,
    RequestRoute,
)
from backend.core.permissions import (
    permission_denied_reason,
    permission_minimum_role,
)
from backend.features.session.models import WebSocketSession
from backend.features.sheet_runtime import handler
from backend.features.sheet_runtime.schema import PerformAction
from backend.protocol.socket import ActionExecutedEvent, StatePatchEvent


class PerformActionRoute(RequestRoute[PerformAction]):
    type_name = "perform_action"
    request_model = PerformAction
    emitted_event_models = (ActionExecutedEvent, StatePatchEvent)
    minimum_role = permission_minimum_role("action_execute")
    permission_denied_reason = permission_denied_reason("action_execute")
    client_generation = ClientGenerationMetadata(
        namespace="sheetRuntime",
        method_name="performAction",
    )

    async def handle(self, session: WebSocketSession, request: PerformAction) -> None:
        await handler.handle_request(session, request)


def register_routes(registry: RequestRegistry) -> None:
    registry.register(PerformActionRoute())
