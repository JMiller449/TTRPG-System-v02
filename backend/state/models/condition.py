from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from backend.state.models.augmentation import Augmentation

ConditionVisibility = Literal["public", "gm_only"]
ConditionSourceType = Literal["action", "manual", "item", "condition", "other"]
ConditionAppliedByRole = Literal["dm", "player"]


@dataclass
class ConditionSource:
    """Why an active condition exists — the action/actor that applied it."""

    type: ConditionSourceType = "other"
    id: str | None = None
    label: str | None = None

    @classmethod
    def from_dict(cls, raw: dict | None) -> "ConditionSource":
        if raw is None:
            return cls()
        return cls(
            type=raw.get("type", "other"),
            id=raw.get("id"),
            label=raw.get("label"),
        )


@dataclass
class ConditionPreset:
    id: str
    name: str
    description: str = ""
    visibility: ConditionVisibility = "public"
    # A condition preset is a pure definition. Its effects are authored inline as
    # augmentation_templates; the concrete per-application augmentation ids live on
    # ActiveCondition, not here.
    augmentation_templates: list[Augmentation] = field(default_factory=list)

    @classmethod
    def from_dict(cls, raw: dict) -> "ConditionPreset":
        return cls(
            id=raw["id"],
            name=raw["name"],
            description=raw.get("description", ""),
            visibility=raw.get("visibility", "public"),
            augmentation_templates=[
                Augmentation.from_dict(augmentation)
                for augmentation in raw.get("augmentation_templates", [])
            ],
        )


@dataclass
class ActiveCondition:
    application_id: str
    condition_id: str
    condition_name: str
    description: str
    visibility: ConditionVisibility
    instance_id: str
    augmentation_ids: list[str] = field(default_factory=list)
    # Source and timing metadata: why the condition is active, who applied it, and when.
    source: ConditionSource = field(default_factory=ConditionSource)
    applied_at: str | None = None
    applied_by_role: ConditionAppliedByRole | None = None
    applied_at_state_version: int | None = None

    @classmethod
    def from_dict(cls, raw: dict) -> "ActiveCondition":
        return cls(
            application_id=raw["application_id"],
            condition_id=raw["condition_id"],
            condition_name=raw["condition_name"],
            description=raw.get("description", ""),
            visibility=raw.get("visibility", "public"),
            instance_id=raw["instance_id"],
            augmentation_ids=list(raw.get("augmentation_ids", [])),
            source=ConditionSource.from_dict(raw.get("source")),
            applied_at=raw.get("applied_at"),
            applied_by_role=raw.get("applied_by_role"),
            applied_at_state_version=raw.get("applied_at_state_version"),
        )
