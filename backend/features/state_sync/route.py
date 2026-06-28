from backend.core.request_registry import (
    ClientGenerationMetadata,
    RequestRegistry,
    RequestRoute,
)
from backend.features.session.models import WebSocketSession
from backend.features.state_sync import handler
from backend.features.state_sync.schema import ResyncState, UndoLastStateChange
from backend.protocol.socket import StatePatchEvent, StateSnapshotEvent


class ResyncStateRoute(RequestRoute[ResyncState]):
    type_name = "resync_state"
    request_model = ResyncState
    emitted_event_models = (StateSnapshotEvent, StatePatchEvent)
    minimum_role = "player"
    client_generation = ClientGenerationMetadata(
        namespace="stateSync",
        method_name="resyncState",
    )

    async def handle(self, session: WebSocketSession, request: ResyncState) -> None:
        await handler.handle_request(session, request)


class UndoLastStateChangeRoute(RequestRoute[UndoLastStateChange]):
    type_name = "undo_last_state_change"
    request_model = UndoLastStateChange
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    permission_denied_reason = "Only a DM can undo state changes."
    client_generation = ClientGenerationMetadata(
        namespace="stateSync",
        method_name="undoLastStateChange",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: UndoLastStateChange,
    ) -> None:
        await handler.handle_undo_last_state_change(request)


def register_routes(registry: RequestRegistry) -> None:
    registry.register(ResyncStateRoute())
    registry.register(UndoLastStateChangeRoute())
