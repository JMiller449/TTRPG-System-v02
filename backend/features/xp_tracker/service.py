from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from backend.features.session.models import SessionRole
from backend.features.state_sync.service import state_sync_service
from backend.features.xp_tracker.schema import (
    XpTracker,
    XpTrackerAdjustment,
    XpTrackerKill,
    XpTrackerKillParticipant,
    XpTrackerMob,
    XpTrackerParty,
    XpTrackerPartyMember,
    XpTrackerRecordableMob,
    XpTrackerSheet,
)
from backend.state.models.sheet import Sheet
from backend.state.models.state import State
from backend.state.models.xp import (
    KillParticipant,
    KillRecord,
    Party,
    XpAdjustment,
    normalize_xp,
)
from backend.state.store import StateSingleton


def _state() -> State:
    return StateSingleton.getState()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _instance_name(state: State, instance_id: str) -> str:
    instance = state.instanced_sheets.get(instance_id)
    if instance is None:
        raise ValueError(f"Instance '{instance_id}' does not exist.")
    sheet = state.sheets.get(instance.parent_id)
    if sheet is None:
        raise ValueError(
            f"Instance '{instance_id}' references missing sheet '{instance.parent_id}'."
        )
    if sheet.dm_only:
        raise ValueError("XP can only be awarded to player sheet instances.")
    return sheet.name


def _player_sheet(state: State, instance_id: str) -> Sheet:
    instance = state.instanced_sheets.get(instance_id)
    if instance is None:
        raise ValueError(f"Instance '{instance_id}' does not exist.")
    sheet = state.sheets.get(instance.parent_id)
    if sheet is None or sheet.dm_only:
        raise ValueError("XP can only be configured for player sheet instances.")
    return sheet


def _kill_view(record: KillRecord) -> XpTrackerKill:
    return XpTrackerKill(
        id=record.id,
        monster_name=record.monster_name,
        base_xp=record.base_xp,
        monster_sheet_id=record.monster_sheet_id,
        participants=[
            XpTrackerKillParticipant(
                instance_id=participant.instance_id,
                name=participant.name,
            )
            for participant in record.participants
        ],
        participant_count=record.participant_count,
        xp_percentage=record.xp_percentage,
        xp_per_participant=record.xp_per_participant,
        occurred_at=record.occurred_at,
        notes=record.notes,
        submitted_by_role=record.submitted_by_role,
        submitted_by_instance_id=record.submitted_by_instance_id,
        submitted_by_name=record.submitted_by_name,
    )


def _adjustment_view(adjustment: XpAdjustment) -> XpTrackerAdjustment:
    return XpTrackerAdjustment(
        id=adjustment.id,
        instance_id=adjustment.instance_id,
        instance_name=adjustment.instance_name,
        amount=adjustment.amount,
        reason=adjustment.reason,
        occurred_at=adjustment.occurred_at,
    )


def _sheet_view(state: State, instance_id: str) -> XpTrackerSheet:
    sheet = _player_sheet(state, instance_id)
    kills = sorted(
        (
            record
            for record in state.kill_registry.values()
            if any(p.instance_id == instance_id for p in record.participants)
        ),
        key=lambda record: (record.occurred_at, record.id),
        reverse=True,
    )
    adjustments = sorted(
        (
            adjustment
            for adjustment in state.xp_adjustments.values()
            if adjustment.instance_id == instance_id
        ),
        key=lambda adjustment: (adjustment.occurred_at, adjustment.id),
        reverse=True,
    )
    current_xp = normalize_xp(
        sum(record.xp_per_participant for record in kills)
        + sum(adjustment.amount for adjustment in adjustments)
    )
    required = normalize_xp(sheet.xp_cap)
    return XpTrackerSheet(
        instance_id=instance_id,
        sheet_id=sheet.id,
        name=sheet.name,
        kills=[_kill_view(record) for record in kills],
        adjustments=[_adjustment_view(adjustment) for adjustment in adjustments],
        current_xp=current_xp,
        xp_required=required,
        ready_to_level=required > 0 and current_xp >= required,
    )


def build_xp_tracker(
    *,
    role: SessionRole,
    assigned_instance_id: str | None = None,
    request_id: str | None = None,
    state: State | None = None,
) -> XpTracker:
    current_state = _state() if state is None else state
    if role == "dm":
        instance_ids = sorted(
            (
                instance_id
                for instance_id, instance in current_state.instanced_sheets.items()
                if instance.parent_id in current_state.sheets
                and not current_state.sheets[instance.parent_id].dm_only
            ),
            key=lambda instance_id: (
                _instance_name(current_state, instance_id).casefold(),
                instance_id,
            ),
        )
        parties = [
            XpTrackerParty(
                id=party.id,
                name=party.name,
                members=[
                    XpTrackerPartyMember(
                        instance_id=instance_id,
                        name=_instance_name(current_state, instance_id),
                    )
                    for instance_id in party.member_instance_ids
                    if instance_id in current_state.instanced_sheets
                ],
            )
            for party in sorted(
                current_state.parties.values(),
                key=lambda party: (party.name.casefold(), party.id),
            )
        ]
        kills = [
            _kill_view(record)
            for record in sorted(
                current_state.kill_registry.values(),
                key=lambda record: (record.occurred_at, record.id),
                reverse=True,
            )
        ]
        adjustments = [
            _adjustment_view(adjustment)
            for adjustment in sorted(
                current_state.xp_adjustments.values(),
                key=lambda adjustment: (adjustment.occurred_at, adjustment.id),
                reverse=True,
            )
        ]
        mobs = [
            XpTrackerMob(
                sheet_id=sheet.id,
                name=sheet.name,
                xp_value=normalize_xp(sheet.xp_given_when_slayed),
                visible_to_players=current_state.player_kill_visibility.get(
                    sheet.id
                )
                is True,
            )
            for sheet in sorted(
                (sheet for sheet in current_state.sheets.values() if sheet.dm_only),
                key=lambda sheet: (sheet.name.casefold(), sheet.id),
            )
        ]
        recordable_mobs = []
    else:
        if assigned_instance_id is None:
            raise PermissionError("Claim a sheet access code before viewing XP.")
        if assigned_instance_id in current_state.instanced_sheets:
            instance_ids = [assigned_instance_id]
            own_sheet = _sheet_view(current_state, assigned_instance_id)
            kills = own_sheet.kills
            adjustments = own_sheet.adjustments
        else:
            instance_ids = []
            kills = []
            adjustments = []
        parties = []
        mobs = []
        recordable_mobs = [
            XpTrackerRecordableMob(sheet_id=sheet.id, name=sheet.name)
            for sheet in sorted(
                (
                    sheet
                    for sheet in current_state.sheets.values()
                    if sheet.dm_only
                    and current_state.player_kill_visibility.get(sheet.id) is True
                ),
                key=lambda sheet: (sheet.name.casefold(), sheet.id),
            )
        ]

    return XpTracker(
        response_id=None,
        can_manage=role == "dm",
        sheets=[_sheet_view(current_state, instance_id) for instance_id in instance_ids],
        parties=parties,
        kills=kills,
        adjustments=adjustments,
        mobs=mobs,
        recordable_mobs=recordable_mobs,
        request_id=request_id,
    )


async def set_sheet_xp_required(
    *, sheet_id: str, xp_required: float, request_id: str | None
) -> None:
    def mutation(state: State) -> tuple[None, list]:
        sheet = state.sheets.get(sheet_id)
        if sheet is None or sheet.dm_only:
            raise ValueError("XP thresholds can only be set on player sheets.")
        path = state_sync_service.join_path("sheets", sheet_id, "xp_cap")
        return None, [
            state_sync_service.set_mutation(state, path, normalize_xp(xp_required))
        ]

    await state_sync_service.apply_mutation(mutation, request_id=request_id)


async def set_mob_xp_value(
    *, mob_sheet_id: str, xp_value: float, request_id: str | None
) -> None:
    def mutation(state: State) -> tuple[None, list]:
        mob = state.sheets.get(mob_sheet_id)
        if mob is None or not mob.dm_only:
            raise ValueError("Monster XP can only be set on DM-only sheets.")
        path = state_sync_service.join_path(
            "sheets", mob_sheet_id, "xp_given_when_slayed"
        )
        return None, [
            state_sync_service.set_mutation(state, path, normalize_xp(xp_value))
        ]

    await state_sync_service.apply_mutation(mutation, request_id=request_id)


async def set_mob_kill_visibility(
    *, mob_sheet_id: str, visible: bool, request_id: str | None
) -> None:
    def mutation(state: State) -> tuple[None, list]:
        mob = state.sheets.get(mob_sheet_id)
        if mob is None or not mob.dm_only:
            raise ValueError("Player kill visibility can only be set on DM-only sheets.")
        path = state_sync_service.join_path(
            "player_kill_visibility", mob_sheet_id
        )
        if visible:
            if state.player_kill_visibility.get(mob_sheet_id) is True:
                return None, []
            return None, [state_sync_service.add_mutation(state, path, True)]
        if mob_sheet_id not in state.player_kill_visibility:
            return None, []
        _, op = state_sync_service.remove_mutation(state, path)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request_id)


async def save_party(
    *, party_id: str, name: str, member_instance_ids: list[str], request_id: str | None
) -> None:
    def mutation(state: State) -> tuple[None, list]:
        normalized_members = sorted(set(member_instance_ids))
        if len(normalized_members) != len(member_instance_ids):
            raise ValueError("A party cannot contain the same character twice.")
        for instance_id in normalized_members:
            _instance_name(state, instance_id)
        for other_id, party in state.parties.items():
            if other_id == party_id:
                continue
            overlap = set(normalized_members) & set(party.member_instance_ids)
            if overlap:
                raise ValueError(
                    f"Instance '{sorted(overlap)[0]}' already belongs to another party."
                )
        party = Party(id=party_id, name=name.strip(), member_instance_ids=normalized_members)
        if not party.name:
            raise ValueError("Party name is required.")
        path = state_sync_service.join_path("parties", party_id)
        if party_id in state.parties:
            op = state_sync_service.set_mutation(state, path, party)
        else:
            op = state_sync_service.add_mutation(state, path, party)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request_id)


async def delete_party(*, party_id: str, request_id: str | None) -> None:
    def mutation(state: State) -> tuple[None, list]:
        if party_id not in state.parties:
            raise ValueError(f"Party '{party_id}' does not exist.")
        _, op = state_sync_service.remove_mutation(
            state, state_sync_service.join_path("parties", party_id)
        )
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request_id)


def _participants(
    state: State,
    participant_instance_ids: list[str],
    *,
    existing_participants: list[KillParticipant] | None = None,
) -> list[KillParticipant]:
    normalized_ids = sorted(set(participant_instance_ids))
    if not normalized_ids:
        raise ValueError("A kill must have at least one participant.")
    if len(normalized_ids) != len(participant_instance_ids):
        raise ValueError("A kill cannot contain the same participant twice.")
    existing_by_id = {
        participant.instance_id: participant
        for participant in (existing_participants or [])
    }
    participants: list[KillParticipant] = []
    for instance_id in normalized_ids:
        if instance_id in state.instanced_sheets:
            participants.append(
                KillParticipant(
                    instance_id=instance_id,
                    name=_instance_name(state, instance_id),
                )
            )
            continue
        existing = existing_by_id.get(instance_id)
        if existing is None:
            raise ValueError(f"Instance '{instance_id}' does not exist.")
        participants.append(existing)
    return participants


def _build_kill(
    *,
    state: State,
    kill_id: str,
    monster_name: str,
    base_xp: float,
    participant_instance_ids: list[str],
    occurred_at: str,
    monster_sheet_id: str | None,
    notes: str,
    submitted_by_role: Literal["player", "dm"] = "dm",
    submitted_by_instance_id: str | None = None,
    submitted_by_name: str | None = None,
    existing_participants: list[KillParticipant] | None = None,
) -> KillRecord:
    participants = _participants(
        state,
        participant_instance_ids,
        existing_participants=existing_participants,
    )
    participant_count = len(participants)
    normalized_base_xp = normalize_xp(base_xp)
    return KillRecord(
        id=kill_id,
        monster_name=monster_name.strip(),
        base_xp=normalized_base_xp,
        participants=participants,
        participant_count=participant_count,
        xp_percentage=normalize_xp(100 / participant_count),
        xp_per_participant=normalize_xp(normalized_base_xp / participant_count),
        occurred_at=occurred_at,
        monster_sheet_id=monster_sheet_id,
        notes=notes,
        submitted_by_role=submitted_by_role,
        submitted_by_instance_id=submitted_by_instance_id,
        submitted_by_name=submitted_by_name,
    )


def _record_kill_in_state(
    *,
    state: State,
    kill_id: str,
    credited_instance_id: str,
    monster_sheet_id: str | None,
    monster_name: str | None,
    base_xp: float | None,
    occurred_at: str | None,
    notes: str,
    submitted_by_role: Literal["player", "dm"],
    submitted_by_instance_id: str | None = None,
    submitted_by_name: str | None = None,
) -> tuple[None, list]:
    if kill_id in state.kill_registry:
        raise ValueError(f"Kill '{kill_id}' already exists.")
    _instance_name(state, credited_instance_id)
    party = next(
        (
            candidate
            for candidate in state.parties.values()
            if credited_instance_id in candidate.member_instance_ids
        ),
        None,
    )
    participant_ids = (
        party.member_instance_ids if party is not None else [credited_instance_id]
    )
    resolved_monster_name = (monster_name or "").strip()
    resolved_base_xp = base_xp
    if monster_sheet_id is not None:
        monster = state.sheets.get(monster_sheet_id)
        if monster is None or not monster.dm_only:
            raise ValueError("Kill monster must reference a DM-only sheet.")
        resolved_monster_name = monster.name
        resolved_base_xp = monster.xp_given_when_slayed
    if not resolved_monster_name:
        raise ValueError("Monster name is required for an arbitrary kill.")
    if resolved_base_xp is None:
        raise ValueError("Base XP is required for an arbitrary kill.")
    record = _build_kill(
        state=state,
        kill_id=kill_id,
        monster_name=resolved_monster_name,
        base_xp=resolved_base_xp,
        participant_instance_ids=participant_ids,
        occurred_at=occurred_at or _now(),
        monster_sheet_id=monster_sheet_id,
        notes=notes,
        submitted_by_role=submitted_by_role,
        submitted_by_instance_id=submitted_by_instance_id,
        submitted_by_name=submitted_by_name,
    )
    path = state_sync_service.join_path("kill_registry", kill_id)
    return None, [state_sync_service.add_mutation(state, path, record)]


async def record_kill(
    *,
    kill_id: str,
    credited_instance_id: str,
    monster_sheet_id: str | None,
    monster_name: str | None,
    base_xp: float | None,
    occurred_at: str | None,
    notes: str,
    request_id: str | None,
) -> None:
    def mutation(state: State) -> tuple[None, list]:
        return _record_kill_in_state(
            state=state,
            kill_id=kill_id,
            credited_instance_id=credited_instance_id,
            monster_sheet_id=monster_sheet_id,
            monster_name=monster_name,
            base_xp=base_xp,
            occurred_at=occurred_at,
            notes=notes,
            submitted_by_role="dm",
        )

    await state_sync_service.apply_mutation(mutation, request_id=request_id)


async def record_player_kill(
    *,
    kill_id: str,
    credited_instance_id: str,
    monster_sheet_id: str,
    request_id: str | None,
) -> None:
    def mutation(state: State) -> tuple[None, list]:
        if state.player_kill_visibility.get(monster_sheet_id) is not True:
            raise PermissionError("That enemy is not currently available to players.")
        submitter_name = _instance_name(state, credited_instance_id)
        return _record_kill_in_state(
            state=state,
            kill_id=kill_id,
            credited_instance_id=credited_instance_id,
            monster_sheet_id=monster_sheet_id,
            monster_name=None,
            base_xp=None,
            occurred_at=None,
            notes="",
            submitted_by_role="player",
            submitted_by_instance_id=credited_instance_id,
            submitted_by_name=submitter_name,
        )

    await state_sync_service.apply_mutation(mutation, request_id=request_id)


async def update_kill(
    *,
    kill_id: str,
    monster_sheet_id: str | None,
    monster_name: str,
    base_xp: float,
    participant_instance_ids: list[str],
    occurred_at: str,
    notes: str,
    request_id: str | None,
) -> None:
    def mutation(state: State) -> tuple[None, list]:
        if kill_id not in state.kill_registry:
            raise ValueError(f"Kill '{kill_id}' does not exist.")
        record = _build_kill(
            state=state,
            kill_id=kill_id,
            monster_name=monster_name,
            base_xp=base_xp,
            participant_instance_ids=participant_instance_ids,
            occurred_at=occurred_at,
            monster_sheet_id=monster_sheet_id,
            notes=notes,
            submitted_by_role=state.kill_registry[kill_id].submitted_by_role,
            submitted_by_instance_id=state.kill_registry[
                kill_id
            ].submitted_by_instance_id,
            submitted_by_name=state.kill_registry[kill_id].submitted_by_name,
            existing_participants=state.kill_registry[kill_id].participants,
        )
        path = state_sync_service.join_path("kill_registry", kill_id)
        return None, [state_sync_service.set_mutation(state, path, record)]

    await state_sync_service.apply_mutation(mutation, request_id=request_id)


async def delete_kill(*, kill_id: str, request_id: str | None) -> None:
    def mutation(state: State) -> tuple[None, list]:
        if kill_id not in state.kill_registry:
            raise ValueError(f"Kill '{kill_id}' does not exist.")
        _, op = state_sync_service.remove_mutation(
            state, state_sync_service.join_path("kill_registry", kill_id)
        )
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request_id)


async def save_xp_adjustment(
    *,
    adjustment_id: str,
    instance_id: str,
    amount: float,
    reason: str,
    occurred_at: str | None,
    request_id: str | None,
) -> None:
    def mutation(state: State) -> tuple[None, list]:
        existing = state.xp_adjustments.get(adjustment_id)
        adjustment = XpAdjustment(
            id=adjustment_id,
            instance_id=instance_id,
            instance_name=_instance_name(state, instance_id),
            amount=normalize_xp(amount),
            reason=reason,
            occurred_at=occurred_at or (existing.occurred_at if existing else _now()),
        )
        path = state_sync_service.join_path("xp_adjustments", adjustment_id)
        op = (
            state_sync_service.set_mutation(state, path, adjustment)
            if existing is not None
            else state_sync_service.add_mutation(state, path, adjustment)
        )
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request_id)


async def delete_xp_adjustment(
    *, adjustment_id: str, request_id: str | None
) -> None:
    def mutation(state: State) -> tuple[None, list]:
        if adjustment_id not in state.xp_adjustments:
            raise ValueError(f"XP adjustment '{adjustment_id}' does not exist.")
        _, op = state_sync_service.remove_mutation(
            state, state_sync_service.join_path("xp_adjustments", adjustment_id)
        )
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request_id)
