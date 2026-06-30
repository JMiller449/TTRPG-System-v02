from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from backend.state.models.augmentation import Augmentation

ConditionVisibility = Literal["public", "gm_only"]


@dataclass
class ConditionPreset:
    id: str
    name: str
    description: str = ""
    visibility: ConditionVisibility = "public"
    augmentation_ids: list[str] = field(default_factory=list)
    augmentation_templates: list[Augmentation] = field(default_factory=list)

    @classmethod
    def from_dict(cls, raw: dict) -> "ConditionPreset":
        return cls(
            id=raw["id"],
            name=raw["name"],
            description=raw.get("description", ""),
            visibility=raw.get("visibility", "public"),
            augmentation_ids=list(raw.get("augmentation_ids", [])),
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
        )
