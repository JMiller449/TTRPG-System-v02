from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from backend.features.session.models import SessionRole

PermissionKey = Literal[
    "notes_edit",
    "instance_notes_edit",
    "equipment_edit",
    "proficiency_edit",
    "stat_edit",
    "resource_edit",
    "action_execute",
]


@dataclass(frozen=True)
class PermissionRule:
    key: PermissionKey
    label: str
    allowed_roles: tuple[SessionRole, ...]
    denied_reason: str

    @property
    def minimum_role(self) -> SessionRole:
        if self.allowed_roles == ("dm",):
            return "dm"
        if self.allowed_roles == ("player", "dm"):
            return "player"
        return "unauthenticated"


PERMISSION_RULES: dict[PermissionKey, PermissionRule] = {
    "notes_edit": PermissionRule(
        key="notes_edit",
        label="Backend notes edits",
        allowed_roles=("dm",),
        denied_reason="Only a DM can edit backend notes.",
    ),
    "instance_notes_edit": PermissionRule(
        key="instance_notes_edit",
        label="Instance notes edits",
        allowed_roles=("player", "dm"),
        denied_reason="Authenticate first to edit instance notes.",
    ),
    "equipment_edit": PermissionRule(
        key="equipment_edit",
        label="Equipment edits",
        allowed_roles=("dm",),
        denied_reason="Only a DM can edit equipment.",
    ),
    "proficiency_edit": PermissionRule(
        key="proficiency_edit",
        label="Proficiency edits",
        allowed_roles=("dm",),
        denied_reason="Only a DM can edit proficiencies.",
    ),
    "stat_edit": PermissionRule(
        key="stat_edit",
        label="Base stat and formula stat edits",
        allowed_roles=("dm",),
        denied_reason="Only a DM can edit sheet stats.",
    ),
    "resource_edit": PermissionRule(
        key="resource_edit",
        label="Current instance resource edits",
        allowed_roles=("player", "dm"),
        denied_reason="Authenticate first to edit current resources.",
    ),
    "action_execute": PermissionRule(
        key="action_execute",
        label="Assigned action execution",
        allowed_roles=("player", "dm"),
        denied_reason="Authenticate first to execute actions.",
    ),
}


def permission_rule(key: PermissionKey) -> PermissionRule:
    return PERMISSION_RULES[key]


def permission_allowed_roles(key: PermissionKey) -> tuple[SessionRole, ...]:
    return permission_rule(key).allowed_roles


def permission_minimum_role(key: PermissionKey) -> SessionRole:
    return permission_rule(key).minimum_role


def permission_denied_reason(key: PermissionKey) -> str:
    return permission_rule(key).denied_reason


def can_role(role: SessionRole, key: PermissionKey) -> bool:
    return role in permission_allowed_roles(key)
