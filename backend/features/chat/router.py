from fastapi import APIRouter, HTTPException, status

from backend.features.chat import handler
from backend.features.chat.schema import (
    Roll20ChatMessageSent,
    SendRoll20ChatMessageRequest,
)

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post(
    "/send",
    response_model=Roll20ChatMessageSent,
)
async def send_roll20_chat_message_endpoint(
    request: SendRoll20ChatMessageRequest,
) -> Roll20ChatMessageSent:
    try:
        return await handler.send_from_http(request)
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
