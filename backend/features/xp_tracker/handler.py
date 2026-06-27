from backend.features.session.models import WebSocketSession
from backend.features.session.service import websocket_sessions
from backend.features.xp_tracker import service
from backend.features.xp_tracker.schema import (
    GetXpTracker,
    SetMobXpValue,
    SetSheetMobKillCount,
    SetSheetXpRequired,
)


async def _send_tracker(
    session: WebSocketSession,
    *,
    request_id: str | None,
) -> None:
    await websocket_sessions.send(
        session,
        service.build_xp_tracker(
            role=session.role,
            assigned_instance_id=session.assigned_instance_id,
            request_id=request_id,
        ),
    )


async def get_xp_tracker(
    session: WebSocketSession,
    request: GetXpTracker,
) -> None:
    await _send_tracker(session, request_id=request.request_id)


async def set_sheet_xp_required(
    session: WebSocketSession,
    request: SetSheetXpRequired,
) -> None:
    await service.set_sheet_xp_required(
        sheet_id=request.sheet_id,
        xp_required=request.xp_required,
        request_id=request.request_id,
    )
    await _send_tracker(session, request_id=None)


async def set_mob_xp_value(
    session: WebSocketSession,
    request: SetMobXpValue,
) -> None:
    await service.set_mob_xp_value(
        mob_sheet_id=request.mob_sheet_id,
        xp_value=request.xp_value,
        request_id=request.request_id,
    )
    await _send_tracker(session, request_id=None)


async def set_sheet_mob_kill_count(
    session: WebSocketSession,
    request: SetSheetMobKillCount,
) -> None:
    await service.set_sheet_mob_kill_count(
        sheet_id=request.sheet_id,
        mob_sheet_id=request.mob_sheet_id,
        count=request.count,
        role=session.role,
        assigned_instance_id=session.assigned_instance_id,
        request_id=request.request_id,
    )
    await _send_tracker(session, request_id=None)
