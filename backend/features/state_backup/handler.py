from __future__ import annotations

from backend.features.session.models import WebSocketSession
from backend.features.session.service import websocket_sessions
from backend.features.state_backup.schema import ExportStateBackup, ImportStateBackup
from backend.features.state_backup import service


async def handle_export_state_backup(
    session: WebSocketSession,
    request: ExportStateBackup,
) -> None:
    await websocket_sessions.send(
        session,
        service.export_state_backup(request_id=request.request_id),
    )


async def handle_import_state_backup(
    session: WebSocketSession,
    request: ImportStateBackup,
) -> None:
    await service.import_state_backup(
        session,
        persisted_state_json=request.persisted_state_json,
        request_id=request.request_id,
    )
