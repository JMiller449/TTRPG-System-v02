from __future__ import annotations

from backend.features.session.models import SessionRole
from backend.features.state_sync.service import state_sync_service
from backend.features.xp_tracker.schema import (
    XpTracker,
    XpTrackerMob,
    XpTrackerSheet,
)
from backend.state.models.sheet import Sheet, SheetSlayedBridge
from backend.state.models.state import State
from backend.state.store import StateSingleton


def _state() -> State:
    return StateSingleton.getState()


def _xp_required(sheet: Sheet) -> int:
    try:
        value = int(sheet.xp_cap.strip())
    except ValueError:
        return 0
    return max(0, value)


def _tracked_mobs(state: State) -> list[Sheet]:
    return sorted(
        (
            sheet
            for sheet in state.sheets.values()
            if sheet.dm_only and sheet.xp_given_when_slayed > 0
        ),
        key=lambda sheet: (sheet.name.casefold(), sheet.id),
    )


def _player_sheet_for_instance(state: State, instance_id: str) -> Sheet:
    instance = state.instanced_sheets.get(instance_id)
    if instance is None:
        raise ValueError(f"Instance '{instance_id}' does not exist.")
    sheet = state.sheets.get(instance.parent_id)
    if sheet is None:
        raise ValueError(
            f"Instance '{instance_id}' references missing sheet '{instance.parent_id}'."
        )
    if sheet.dm_only:
        raise ValueError("XP progress can only be recorded on player sheets.")
    return sheet


def _dm_player_sheet(state: State, sheet_id: str) -> Sheet:
    sheet = state.sheets.get(sheet_id)
    if sheet is None and sheet_id in state.instanced_sheets:
        return _player_sheet_for_instance(state, sheet_id)
    if sheet is None:
        raise ValueError(f"Sheet or instance '{sheet_id}' does not exist.")
    if sheet.dm_only:
        raise ValueError("XP progress can only be configured on player sheets.")
    return sheet


def _mob_sheet(state: State, mob_sheet_id: str) -> Sheet:
    mob = state.sheets.get(mob_sheet_id)
    if mob is None:
        raise ValueError(f"Mob sheet '{mob_sheet_id}' does not exist.")
    if not mob.dm_only:
        raise ValueError("Mob XP values can only be configured on DM-only sheets.")
    return mob


def _tracker_sheet(
    sheet: Sheet,
    mobs: list[Sheet],
    *,
    can_view_progress: bool,
    can_view_mob_values: bool,
) -> XpTrackerSheet:
    mob_rows: list[XpTrackerMob] = []
    current_xp = 0
    for mob in mobs:
        bridge = sheet.slayed_record.get(mob.id)
        count = bridge.count if bridge is not None else 0
        earned = count * mob.xp_given_when_slayed
        current_xp += earned
        mob_rows.append(
            XpTrackerMob(
                sheet_id=mob.id,
                name=mob.name,
                count=count,
                xp_value=mob.xp_given_when_slayed if can_view_mob_values else None,
                xp_earned=earned if can_view_mob_values else None,
            )
        )

    required = _xp_required(sheet)
    return XpTrackerSheet(
        sheet_id=sheet.id,
        name=sheet.name,
        mobs=mob_rows,
        current_xp=current_xp if can_view_progress else None,
        xp_required=required if can_view_progress else None,
        ready_to_level=(required > 0 and current_xp >= required)
        if can_view_progress
        else None,
    )


def build_xp_tracker(
    *,
    role: SessionRole,
    assigned_instance_id: str | None = None,
    request_id: str | None = None,
    state: State | None = None,
) -> XpTracker:
    current_state = _state() if state is None else state
    mobs = _tracked_mobs(current_state)
    if role == "dm":
        sheets = sorted(
            (sheet for sheet in current_state.sheets.values() if not sheet.dm_only),
            key=lambda sheet: (sheet.name.casefold(), sheet.id),
        )
        can_view_progress = True
        can_view_mob_values = True
    else:
        if assigned_instance_id is None:
            raise PermissionError(
                "Claim a sheet access code before recording mob kills."
            )
        sheets = [_player_sheet_for_instance(current_state, assigned_instance_id)]
        can_view_progress = True
        can_view_mob_values = False

    return XpTracker(
        response_id=None,
        can_view_progress=can_view_progress,
        sheets=[
            _tracker_sheet(
                sheet,
                mobs,
                can_view_progress=can_view_progress,
                can_view_mob_values=can_view_mob_values,
            )
            for sheet in sheets
        ],
        request_id=request_id,
    )


async def set_sheet_xp_required(
    *,
    sheet_id: str,
    xp_required: int,
    request_id: str | None,
) -> None:
    def mutation(state: State) -> tuple[None, list]:
        sheet = _dm_player_sheet(state, sheet_id)
        path = state_sync_service.join_path("sheets", sheet.id, "xp_cap")
        op = state_sync_service.set_mutation(state, path, str(xp_required))
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request_id)


async def set_mob_xp_value(
    *,
    mob_sheet_id: str,
    xp_value: int,
    request_id: str | None,
) -> None:
    def mutation(state: State) -> tuple[None, list]:
        mob = _mob_sheet(state, mob_sheet_id)
        path = state_sync_service.join_path(
            "sheets", mob.id, "xp_given_when_slayed"
        )
        op = state_sync_service.set_mutation(state, path, xp_value)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request_id)


async def set_sheet_mob_kill_count(
    *,
    sheet_id: str,
    mob_sheet_id: str,
    count: int,
    role: SessionRole,
    assigned_instance_id: str | None,
    request_id: str | None,
) -> None:
    def mutation(state: State) -> tuple[None, list]:
        if role == "player":
            if assigned_instance_id is None or sheet_id != assigned_instance_id:
                raise PermissionError(
                    "You can only record mob kills for your assigned sheet instance."
                )
            sheet = _player_sheet_for_instance(state, sheet_id)
        else:
            sheet = _dm_player_sheet(state, sheet_id)

        mob = _mob_sheet(state, mob_sheet_id)
        if mob.xp_given_when_slayed <= 0:
            raise ValueError(f"Mob sheet '{mob_sheet_id}' is not tracked for XP.")

        path = state_sync_service.join_path(
            "sheets", sheet.id, "slayed_record", mob.id
        )
        existing = sheet.slayed_record.get(mob.id)
        if count == 0:
            if existing is None:
                return None, []
            _, op = state_sync_service.remove_mutation(state, path)
            return None, [op]

        bridge = SheetSlayedBridge(sheet_id=mob.id, count=count)
        if existing is None:
            op = state_sync_service.add_mutation(state, path, bridge)
        else:
            op = state_sync_service.set_mutation(state, path, bridge)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request_id)
