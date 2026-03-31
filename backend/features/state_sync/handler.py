from backend.features.session.models import WebSocketSession
from backend.features.session.service import websocket_sessions
from backend.features.state_sync.schema import ResyncState
from backend.features.state_sync import service


async def send_connection_bootstrap(session: WebSocketSession) -> None:
    await service.send_bootstrap(session)


async def handle_request(session: WebSocketSession, request: ResyncState) -> None:
    if request.last_seen_version is None:
        await websocket_sessions.send(
            session,
            await service.state_sync_service.snapshot(request_id=request.request_id),
        )
        return

    replay = await service.state_sync_service.replay_since(request.last_seen_version)
    if replay is None or not replay:
        await websocket_sessions.send(
            session,
            await service.state_sync_service.snapshot(request_id=request.request_id),
        )
        return

    for patch in replay:
        patch.request_id = request.request_id
        await websocket_sessions.send(session, patch)
