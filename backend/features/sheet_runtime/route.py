from backend.core.request_registry import RequestRegistry, RequestRoute
from backend.features.session.models import WebSocketSession
from backend.features.sheet_runtime import handler
from backend.features.sheet_runtime.schema import PerformAction


class PerformActionRoute(RequestRoute[PerformAction]):
    type_name = "perform_action"
    request_model = PerformAction

    async def handle(self, session: WebSocketSession, request: PerformAction) -> None:
        await handler.handle_request(session, request)


def register_routes(registry: RequestRegistry) -> None:
    registry.register(PerformActionRoute())
