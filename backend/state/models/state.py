from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

from backend.state.models.action import Action
from backend.state.models.augmentation import Augmentation
from backend.state.models.condition import ConditionPreset
from backend.state.models.formula import FormulaDefinition
from backend.state.models.item import Item
from backend.state.models.proficiency import Proficiency
from backend.state.models.sheet import InstancedSheet, Sheet


@dataclass
class State:
    sheets: dict[str, Sheet] = field(default_factory=dict)
    instanced_sheets: dict[str, InstancedSheet] = field(default_factory=dict)
    formulas: dict[str, FormulaDefinition] = field(default_factory=dict)
    actions: dict[str, Action] = field(default_factory=dict)
    items: dict[str, Item] = field(default_factory=dict)
    proficiencies: dict[str, Proficiency] = field(default_factory=dict)
    augmentations: dict[str, Augmentation] = field(default_factory=dict)
    condition_presets: dict[str, ConditionPreset] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "State":
        return cls(
            sheets={
                key: Sheet.from_dict(sheet)
                for key, sheet in raw.get("sheets", {}).items()
            },
            instanced_sheets={
                key: InstancedSheet.from_dict(sheet)
                for key, sheet in raw.get("instanced_sheets", {}).items()
            },
            formulas={
                key: FormulaDefinition.from_dict(formula)
                for key, formula in raw.get("formulas", {}).items()
            },
            actions={
                key: Action.from_dict(action)
                for key, action in raw.get("actions", {}).items()
            },
            items={
                key: Item.from_dict(item) for key, item in raw.get("items", {}).items()
            },
            proficiencies={
                key: Proficiency.from_dict(proficiency)
                for key, proficiency in raw.get("proficiencies", {}).items()
            },
            augmentations={
                key: Augmentation.from_dict(augmentation)
                for key, augmentation in raw.get("augmentations", {}).items()
            },
            condition_presets={
                key: ConditionPreset.from_dict(condition)
                for key, condition in raw.get("condition_presets", {}).items()
            },
        )

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
