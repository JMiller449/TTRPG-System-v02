from backend.core.request_registry import RequestRegistry, RequestRoute
from backend.features.session.models import WebSocketSession
from backend.features.state_sync import handler
from backend.features.state_sync.schema import ResyncState
from backend.protocol.socket import StatePatchEvent, StateSnapshotEvent


class ResyncStateRoute(RequestRoute[ResyncState]):
    type_name = "resync_state"
    request_model = ResyncState
    emitted_event_models = (StateSnapshotEvent, StatePatchEvent)

    async def handle(self, session: WebSocketSession, request: ResyncState) -> None:
        await handler.handle_request(session, request)


def register_routes(registry: RequestRegistry) -> None:
    registry.register(ResyncStateRoute())
