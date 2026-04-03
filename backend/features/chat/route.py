from backend.features.chat import handler
from backend.features.chat.schema import SendRoll20ChatMessage
from backend.features.session.models import WebSocketSession
from backend.core.request_registry import (
    ClientGenerationMetadata,
    RequestRegistry,
    RequestRoute,
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


def register_routes(registry: RequestRegistry) -> None:
    registry.register(SendRoll20ChatMessageRoute())
