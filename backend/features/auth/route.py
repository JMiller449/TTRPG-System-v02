from backend.core.request_registry import (
    ClientGenerationMetadata,
    RequestRegistry,
    RequestRoute,
)
from backend.features.auth import service as auth_service
from backend.features.auth.schema import Authenticate
from backend.features.session.models import WebSocketSession
from backend.features.state_sync import handler as state_sync_handler
from backend.protocol.socket import AuthenticateResponseEvent, StateSnapshotEvent


class AuthenticateRoute(RequestRoute[Authenticate]):
    type_name = "authenticate"
    request_model = Authenticate
    emitted_event_models = (AuthenticateResponseEvent, StateSnapshotEvent)
    minimum_role = "unauthenticated"
    client_generation = ClientGenerationMetadata(
        namespace="auth",
        method_name="authenticate",
    )

    async def handle(self, session: WebSocketSession, request: Authenticate) -> None:
        updated_session = await auth_service.authenticate_application_session(
            session,
            request,
        )
        if updated_session is None:
            return
        await state_sync_handler.send_connection_bootstrap(updated_session)


def register_routes(registry: RequestRegistry) -> None:
    registry.register(AuthenticateRoute())
