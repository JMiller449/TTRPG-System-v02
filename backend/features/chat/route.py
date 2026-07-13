from backend.features.chat import handler
from backend.features.chat.schema import (
    GetRoll20BridgeStatus,
    GetRoll20BridgeSyncConfig,
    SendRoll20ChatMessage,
)
from backend.features.session.models import WebSocketSession
from backend.core.request_registry import (
    ClientGenerationMetadata,
    RequestRegistry,
    RequestRoute,
)
from backend.protocol.socket import (
    Roll20BridgeStatusEvent,
    Roll20BridgeSyncConfigEvent,
)


class SendRoll20ChatMessageRoute(RequestRoute[SendRoll20ChatMessage]):
    type_name = "send_roll20_chat_message"
    request_model = SendRoll20ChatMessage
    minimum_role = "player"
    client_generation = ClientGenerationMetadata(
        namespace="chat",
        method_name="sendRoll20ChatMessage",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: SendRoll20ChatMessage,
    ) -> None:
        await handler.handle_request(session, request)


class GetRoll20BridgeStatusRoute(RequestRoute[GetRoll20BridgeStatus]):
    type_name = "get_roll20_bridge_status"
    request_model = GetRoll20BridgeStatus
    emitted_event_models = (Roll20BridgeStatusEvent,)
    minimum_role = "player"
    client_generation = ClientGenerationMetadata(
        namespace="chat",
        method_name="getRoll20BridgeStatus",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: GetRoll20BridgeStatus,
    ) -> None:
        await handler.handle_bridge_status_request(session, request)


class GetRoll20BridgeSyncConfigRoute(RequestRoute[GetRoll20BridgeSyncConfig]):
    type_name = "get_roll20_bridge_sync_config"
    request_model = GetRoll20BridgeSyncConfig
    emitted_event_models = (Roll20BridgeSyncConfigEvent,)
    minimum_role = "player"
    client_generation = ClientGenerationMetadata(
        namespace="chat",
        method_name="getRoll20BridgeSyncConfig",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: GetRoll20BridgeSyncConfig,
    ) -> None:
        await handler.handle_bridge_sync_config_request(session, request)


def register_routes(registry: RequestRegistry) -> None:
    registry.register(SendRoll20ChatMessageRoute())
    registry.register(GetRoll20BridgeStatusRoute())
    registry.register(GetRoll20BridgeSyncConfigRoute())
