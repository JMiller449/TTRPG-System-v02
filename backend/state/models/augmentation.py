from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from backend.state.models.formula import Formula

AugmentationSourceType = Literal[
    "item",
    "action",
    "spell",
    "condition",
    "ally_effect",
    "manual",
    "other",
]
AugmentationScope = Literal["sheet", "instance"]
AugmentationTargetRoot = Literal["state", "sheet", "instance"]
AugmentationOperation = Literal["add", "subtract", "multiply", "divide", "set"]


@dataclass
class AugmentationSource:
    type: AugmentationSourceType
    id: str | None = None
    label: str | None = None

    @classmethod
    def from_dict(cls, raw: dict) -> "AugmentationSource":
        return cls(
            type=raw["type"],
            id=raw.get("id"),
            label=raw.get("label"),
        )


@dataclass
class AugmentationTarget:
    root: AugmentationTargetRoot
    path: list[str]

    @classmethod
    def from_dict(cls, raw: dict) -> "AugmentationTarget":
        return cls(
            root=raw["root"],
            path=list(raw["path"]),
        )


@dataclass
class FormulaModifierEffect:
    operation: AugmentationOperation
    value: Formula
    type: Literal["formula_modifier"] = "formula_modifier"

    @classmethod
    def from_dict(cls, raw: dict) -> "FormulaModifierEffect":
        return cls(
            operation=raw["operation"],
            value=Formula.from_dict(raw["value"]),
        )


AugmentationEffect = FormulaModifierEffect


@dataclass
class AugmentationLifecycle:
    # MVP lifecycle fields are descriptive metadata only; no predicate syntax is executed.
    duration: str | None = None
    expires_at: str | None = None
    removal_condition: str | None = None

    @classmethod
    def from_dict(cls, raw: dict | None) -> "AugmentationLifecycle":
        if raw is None:
            return cls()
        return cls(
            duration=raw.get("duration"),
            expires_at=raw.get("expires_at"),
            removal_condition=raw.get("removal_condition"),
        )


@dataclass
class Augmentation:
    id: str
    name: str
    source: AugmentationSource
    scope: AugmentationScope
    target: AugmentationTarget
    effect: AugmentationEffect
    description: str = ""
    active: bool = True
    applied: bool = False
    applied_target_id: str | None = None
    lifecycle: AugmentationLifecycle = field(default_factory=AugmentationLifecycle)

    @classmethod
    def from_dict(cls, raw: dict) -> "Augmentation":
        raw_effect = raw["effect"]
        effect_type = raw_effect["type"]
        if effect_type != "formula_modifier":
            raise ValueError(f"Unsupported augmentation effect type '{effect_type}'.")

        return cls(
            id=raw["id"],
            name=raw["name"],
            description=raw.get("description", ""),
            source=AugmentationSource.from_dict(raw["source"]),
            scope=raw["scope"],
            target=AugmentationTarget.from_dict(raw["target"]),
            effect=FormulaModifierEffect.from_dict(raw_effect),
            active=raw.get("active", True),
            applied=raw.get("applied", False),
            applied_target_id=raw.get("applied_target_id"),
            lifecycle=AugmentationLifecycle.from_dict(raw.get("lifecycle")),
        )
