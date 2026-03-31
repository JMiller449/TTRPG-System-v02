from backend.core.transport import Error
from backend.features.session.models import WebSocketSession
from backend.features.session.service import websocket_sessions
from backend.features.sheet_admin.shared import service
from backend.features.sheet_admin.shared.schema import SheetAdminRequest


async def handle_request(session: WebSocketSession, request: SheetAdminRequest) -> None:
    try:
        await service.dispatch_admin_request(request)
    except (NotImplementedError, ValueError) as exc:
        await websocket_sessions.send(
            session,
            Error(
                response_id=None,
                reason=str(exc),
                request_id=request.request_id,
            ),
        )
        return
