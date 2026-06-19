from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

ActionHistoryActorRole = Literal["player", "dm"]
ActionHistoryStatus = Literal["success", "failed"]
ActionHistoryVisibility = Literal["public", "gm_only"]
ACTION_HISTORY_RETENTION_LIMIT = 200


@dataclass
class ActionHistoryText:
    text: str
    visibility: ActionHistoryVisibility = "gm_only"

    @classmethod
    def from_dict(cls, raw: dict) -> "ActionHistoryText":
        return cls(
            text=raw["text"],
            visibility=raw.get("visibility", "gm_only"),
        )


@dataclass
class ActionHistoryEntry:
    id: str
    action_id: str
    action_name: str
    actor_role: ActionHistoryActorRole
    actor_sheet_id: str
    actor_instance_id: str | None
    target_sheet_id: str | None
    created_at: str
    state_version: int
    status: ActionHistoryStatus
    public_summary: str
    gm_summary: str
    request_id: str | None = None
    emitted_messages: list[ActionHistoryText] = field(default_factory=list)
    mutation_summaries: list[ActionHistoryText] = field(default_factory=list)
    formula_summaries: list[ActionHistoryText] = field(default_factory=list)
    error: ActionHistoryText | None = None

    @classmethod
    def from_dict(cls, raw: dict) -> "ActionHistoryEntry":
        raw_error = raw.get("error")
        return cls(
            id=raw["id"],
            request_id=raw.get("request_id"),
            action_id=raw["action_id"],
            action_name=raw["action_name"],
            actor_role=raw["actor_role"],
            actor_sheet_id=raw["actor_sheet_id"],
            actor_instance_id=raw.get("actor_instance_id"),
            target_sheet_id=raw.get("target_sheet_id"),
            created_at=raw["created_at"],
            state_version=raw["state_version"],
            status=raw["status"],
            public_summary=raw["public_summary"],
            gm_summary=raw["gm_summary"],
            emitted_messages=[
                ActionHistoryText.from_dict(message)
                for message in raw.get("emitted_messages", [])
            ],
            mutation_summaries=[
                ActionHistoryText.from_dict(summary)
                for summary in raw.get("mutation_summaries", [])
            ],
            formula_summaries=[
                ActionHistoryText.from_dict(summary)
                for summary in raw.get("formula_summaries", [])
            ],
            error=ActionHistoryText.from_dict(raw_error)
            if raw_error is not None
            else None,
        )


def prune_action_history(
    entries: dict[str, ActionHistoryEntry],
    *,
    retention_limit: int = ACTION_HISTORY_RETENTION_LIMIT,
) -> dict[str, ActionHistoryEntry]:
    if retention_limit < 1:
        return {}

    retained = sorted(
        entries.items(),
        key=lambda item: (item[1].created_at, item[1].id),
    )[-retention_limit:]
    return dict(retained)


def add_action_history_entry(
    entries: dict[str, ActionHistoryEntry],
    entry: ActionHistoryEntry,
    *,
    retention_limit: int = ACTION_HISTORY_RETENTION_LIMIT,
) -> None:
    entries[entry.id] = entry
    retained = prune_action_history(entries, retention_limit=retention_limit)
    entries.clear()
    entries.update(retained)
