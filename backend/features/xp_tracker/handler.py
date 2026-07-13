from backend.features.session.models import WebSocketSession
from backend.features.session.service import websocket_sessions
from backend.features.xp_tracker import service
from backend.features.xp_tracker.schema import (
    DeleteKill,
    DeleteParty,
    DeleteXpAdjustment,
    GetXpTracker,
    RecordKill,
    RecordPlayerKill,
    SaveParty,
    SaveXpAdjustment,
    SetMobXpValue,
    SetMobKillVisibility,
    SetSheetXpRequired,
    UpdateKill,
)


async def _send_tracker(
    session: WebSocketSession, *, request_id: str | None
) -> None:
    await websocket_sessions.send(
        session,
        service.build_xp_tracker(
            role=session.role,
            assigned_instance_id=session.assigned_instance_id,
            request_id=request_id,
        ),
    )


async def _broadcast_trackers(
    *,
    requesting_session: WebSocketSession | None = None,
    request_id: str | None = None,
) -> None:
    await websocket_sessions.broadcast_per_session(
        lambda session: service.build_xp_tracker(
            role=session.role,
            assigned_instance_id=session.assigned_instance_id,
            request_id=(
                request_id if session is requesting_session else None
            ),
        )
    )


async def get_xp_tracker(session: WebSocketSession, request: GetXpTracker) -> None:
    await _send_tracker(session, request_id=request.request_id)


async def set_sheet_xp_required(
    session: WebSocketSession, request: SetSheetXpRequired
) -> None:
    await service.set_sheet_xp_required(
        sheet_id=request.sheet_id,
        xp_required=request.xp_required,
        request_id=request.request_id,
    )
    await _broadcast_trackers()


async def set_mob_xp_value(
    session: WebSocketSession, request: SetMobXpValue
) -> None:
    await service.set_mob_xp_value(
        mob_sheet_id=request.mob_sheet_id,
        xp_value=request.xp_value,
        request_id=request.request_id,
    )
    await _broadcast_trackers()


async def set_mob_kill_visibility(
    session: WebSocketSession, request: SetMobKillVisibility
) -> None:
    await service.set_mob_kill_visibility(
        mob_sheet_id=request.mob_sheet_id,
        visible=request.visible,
        request_id=request.request_id,
    )
    await _broadcast_trackers(
        requesting_session=session,
        request_id=request.request_id,
    )


async def save_party(session: WebSocketSession, request: SaveParty) -> None:
    await service.save_party(
        party_id=request.party_id,
        name=request.name,
        member_instance_ids=request.member_instance_ids,
        request_id=request.request_id,
    )
    await _broadcast_trackers()


async def delete_party(session: WebSocketSession, request: DeleteParty) -> None:
    await service.delete_party(
        party_id=request.party_id, request_id=request.request_id
    )
    await _broadcast_trackers()


async def record_kill(session: WebSocketSession, request: RecordKill) -> None:
    await service.record_kill(
        kill_id=request.kill_id,
        credited_instance_id=request.credited_instance_id,
        monster_sheet_id=request.monster_sheet_id,
        monster_name=request.monster_name,
        base_xp=request.base_xp,
        occurred_at=request.occurred_at,
        notes=request.notes,
        request_id=request.request_id,
    )
    await _broadcast_trackers()


async def record_player_kill(
    session: WebSocketSession, request: RecordPlayerKill
) -> None:
    if session.role != "player":
        raise PermissionError("This request requires an authenticated player session.")
    if session.assigned_instance_id is None:
        raise PermissionError("Claim a sheet access code before recording kills.")
    await service.record_player_kill(
        kill_id=request.kill_id,
        credited_instance_id=session.assigned_instance_id,
        monster_sheet_id=request.monster_sheet_id,
        request_id=request.request_id,
    )
    await _broadcast_trackers(
        requesting_session=session,
        request_id=request.request_id,
    )


async def update_kill(session: WebSocketSession, request: UpdateKill) -> None:
    await service.update_kill(
        kill_id=request.kill_id,
        monster_sheet_id=request.monster_sheet_id,
        monster_name=request.monster_name,
        base_xp=request.base_xp,
        participant_instance_ids=request.participant_instance_ids,
        occurred_at=request.occurred_at,
        notes=request.notes,
        request_id=request.request_id,
    )
    await _broadcast_trackers()


async def delete_kill(session: WebSocketSession, request: DeleteKill) -> None:
    await service.delete_kill(kill_id=request.kill_id, request_id=request.request_id)
    await _broadcast_trackers()


async def save_xp_adjustment(
    session: WebSocketSession, request: SaveXpAdjustment
) -> None:
    await service.save_xp_adjustment(
        adjustment_id=request.adjustment_id,
        instance_id=request.instance_id,
        amount=request.amount,
        reason=request.reason,
        occurred_at=request.occurred_at,
        request_id=request.request_id,
    )
    await _broadcast_trackers()


async def delete_xp_adjustment(
    session: WebSocketSession, request: DeleteXpAdjustment
) -> None:
    await service.delete_xp_adjustment(
        adjustment_id=request.adjustment_id,
        request_id=request.request_id,
    )
    await _broadcast_trackers()
