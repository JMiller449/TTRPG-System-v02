from __future__ import annotations

from backend.features.session.models import SessionRole
from backend.protocol.state_schema import ActionHistoryEntryPayload
from backend.state.models.action_history import (
    ACTION_HISTORY_RETENTION_LIMIT,
    ActionHistoryEntry,
    ActionHistoryText,
    add_action_history_entry,
)
from backend.state.models.state import State


def record_action_history_entry(
    state: State,
    entry: ActionHistoryEntry,
    *,
    retention_limit: int = ACTION_HISTORY_RETENTION_LIMIT,
) -> tuple[str, ...]:
    previous_ids = set(state.action_history)
    add_action_history_entry(
        state.action_history,
        entry,
        retention_limit=retention_limit,
    )
    return tuple(sorted(previous_ids - set(state.action_history)))


def _visible_texts(
    values: list[ActionHistoryText],
    *,
    role: SessionRole,
) -> list[str]:
    if role == "dm":
        return [value.text for value in values]
    return [value.text for value in values if value.visibility == "public"]


def can_view_action_history_entry(
    entry: ActionHistoryEntry,
    *,
    role: SessionRole,
    assigned_instance_id: str | None = None,
) -> bool:
    if role == "dm":
        return True
    if role != "player":
        return False
    return entry.actor_instance_id is not None and entry.actor_instance_id == assigned_instance_id


def serialize_action_history_entry(
    entry: ActionHistoryEntry,
    *,
    role: SessionRole,
    assigned_instance_id: str | None = None,
) -> ActionHistoryEntryPayload | None:
    if not can_view_action_history_entry(
        entry,
        role=role,
        assigned_instance_id=assigned_instance_id,
    ):
        return None

    is_dm = role == "dm"
    visible_error = None
    if entry.error is not None and (is_dm or entry.error.visibility == "public"):
        visible_error = entry.error.text

    return ActionHistoryEntryPayload(
        id=entry.id,
        request_id=entry.request_id,
        action_id=entry.action_id,
        action_name=entry.action_name,
        actor_role=entry.actor_role,
        actor_sheet_id=entry.actor_sheet_id,
        actor_instance_id=entry.actor_instance_id,
        target_sheet_id=entry.target_sheet_id,
        created_at=entry.created_at,
        state_version=entry.state_version,
        status=entry.status,
        summary=entry.gm_summary if is_dm else entry.public_summary,
        emitted_messages=_visible_texts(entry.emitted_messages, role=role),
        mutation_summaries=_visible_texts(entry.mutation_summaries, role=role),
        formula_summaries=_visible_texts(entry.formula_summaries, role=role),
        error=visible_error,
        redacted=not is_dm,
    )


def serialize_action_history(
    entries: dict[str, ActionHistoryEntry],
    *,
    role: SessionRole,
    assigned_instance_id: str | None = None,
) -> dict[str, ActionHistoryEntryPayload]:
    payloads: dict[str, ActionHistoryEntryPayload] = {}
    for entry_id, entry in entries.items():
        payload = serialize_action_history_entry(
            entry,
            role=role,
            assigned_instance_id=assigned_instance_id,
        )
        if payload is not None:
            payloads[entry_id] = payload
    return payloads
