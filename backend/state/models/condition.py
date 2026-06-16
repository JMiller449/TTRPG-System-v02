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
