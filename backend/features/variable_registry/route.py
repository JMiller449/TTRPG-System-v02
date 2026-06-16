from backend.core.request_registry import (
    ClientGenerationMetadata,
    RequestRegistry,
    RequestRoute,
)
from backend.features.session.models import WebSocketSession
from backend.features.variable_registry import handler
from backend.features.variable_registry.schema import GetVariableRegistry
from backend.protocol.socket import VariableRegistryEvent


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


def register_routes(registry: RequestRegistry) -> None:
    registry.register(GetVariableRegistryRoute())
