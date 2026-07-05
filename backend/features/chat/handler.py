from backend.core.transport import Error
from backend.features.chat import service
from backend.features.chat.schema import (
    GetRoll20BridgeStatus,
    GetRoll20BridgeSyncConfig,
    SendRoll20ChatMessage,
)
from backend.features.auth.tokens import SERVICE_AUTH_CODE
from backend.protocol.socket import (
    Roll20BridgeStatusEvent,
    Roll20BridgeSyncConfigEvent,
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


async def handle_bridge_status_request(
    session: WebSocketSession,
    request: GetRoll20BridgeStatus,
) -> None:
    await websocket_sessions.send(
        session,
        Roll20BridgeStatusEvent(
            response_id=None,
            connected=await service.roll20_chat_bridge.is_connected(),
            request_id=request.request_id,
        ),
    )


async def handle_bridge_sync_config_request(
    session: WebSocketSession,
    request: GetRoll20BridgeSyncConfig,
) -> None:
    await websocket_sessions.send(
        session,
        Roll20BridgeSyncConfigEvent(
            response_id=None,
            service_auth_code=SERVICE_AUTH_CODE,
            request_id=request.request_id,
        ),
    )
