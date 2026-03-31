from backend.core.transport import Error
from backend.features.auth import tokens as auth_tokens
from backend.features.chat import service
from backend.features.chat.schema import (
    Roll20ChatMessageSent,
    SendRoll20ChatMessage,
    SendRoll20ChatMessageRequest,
)
from backend.features.session.models import WebSocketSession
from backend.features.session.service import websocket_sessions


async def handle_request(
    session: WebSocketSession,
    request: SendRoll20ChatMessage,
) -> None:
    chat_message = service.build_chat_message(request)
    try:
        await service.roll20_chat_bridge.send(chat_message)
    except RuntimeError as exc:
        await websocket_sessions.send(
            session,
            Error(
                response_id=None,
                reason=str(exc),
                request_id=request.request_id,
            ),
        )
        return

    await websocket_sessions.send(
        session,
        service.build_chat_sent_response(chat_message),
    )


async def send_from_http(
    request: SendRoll20ChatMessageRequest,
) -> Roll20ChatMessageSent:
    if not auth_tokens.is_valid_dm_admin_code(request.admin_code):
        raise PermissionError("Invalid DM admin code.")

    chat_message = service.build_chat_message(
        SendRoll20ChatMessage(
            type="send_roll20_chat_message",
            message=request.message,
        )
    )
    await service.roll20_chat_bridge.send(chat_message)
    return service.build_chat_sent_response(chat_message)
