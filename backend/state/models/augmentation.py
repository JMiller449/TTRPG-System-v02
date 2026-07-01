from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from backend.state.models.formula import Formula, normalize_formula_tags

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
RollMode = Literal["advantage", "disadvantage"]
AugmentationLifecycleOwner = Literal["manual", "equipment", "condition", "action"]


@dataclass
class AugmentationSource:
    type: AugmentationSourceType
    id: str | None = None
    label: str | None = None
    relationship_id: str | None = None
    application_id: str | None = None

    @classmethod
    def from_dict(cls, raw: dict) -> "AugmentationSource":
        return cls(
            type=raw["type"],
            id=raw.get("id"),
            label=raw.get("label"),
            relationship_id=raw.get("relationship_id"),
            application_id=raw.get("application_id"),
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


def _normalize_selector_id(value: str | None, *, label: str) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    if not normalized:
        raise ValueError(f"Formula modifier selector {label} must not be empty.")
    return normalized


@dataclass
class FormulaModifierSelector:
    required_tags: list[str] = field(default_factory=list)
    excluded_tags: list[str] = field(default_factory=list)
    action_id: str | None = None
    formula_id: str | None = None
    step_id: str | None = None

    def __post_init__(self) -> None:
        self.required_tags = normalize_formula_tags(self.required_tags)
        self.excluded_tags = normalize_formula_tags(self.excluded_tags)
        overlap = set(self.required_tags) & set(self.excluded_tags)
        if overlap:
            tags = ", ".join(sorted(overlap))
            raise ValueError(
                "Formula modifier selector tags cannot be both required and "
                f"excluded: {tags}."
            )
        self.action_id = _normalize_selector_id(self.action_id, label="action_id")
        self.formula_id = _normalize_selector_id(self.formula_id, label="formula_id")
        self.step_id = _normalize_selector_id(self.step_id, label="step_id")

    @classmethod
    def from_dict(cls, raw: dict | None) -> "FormulaModifierSelector":
        if raw is None:
            return cls()
        return cls(
            required_tags=list(raw.get("required_tags", [])),
            excluded_tags=list(raw.get("excluded_tags", [])),
            action_id=raw.get("action_id"),
            formula_id=raw.get("formula_id"),
            step_id=raw.get("step_id"),
        )

    def matches(
        self,
        *,
        tags: list[str],
        action_id: str | None = None,
        formula_id: str | None = None,
        step_id: str | None = None,
    ) -> bool:
        context_tags = set(normalize_formula_tags(tags))
        if not set(self.required_tags).issubset(context_tags):
            return False
        if set(self.excluded_tags) & context_tags:
            return False
        return all(
            expected is None or expected == actual
            for expected, actual in (
                (self.action_id, action_id),
                (self.formula_id, formula_id),
                (self.step_id, step_id),
            )
        )


@dataclass
class FormulaModifierEffect:
    operation: AugmentationOperation
    value: Formula
    selector: FormulaModifierSelector = field(default_factory=FormulaModifierSelector)
    type: Literal["formula_modifier"] = "formula_modifier"

    @classmethod
    def from_dict(cls, raw: dict) -> "FormulaModifierEffect":
        return cls(
            operation=raw["operation"],
            value=Formula.from_dict(raw["value"]),
            selector=FormulaModifierSelector.from_dict(raw.get("selector")),
        )


@dataclass
class EvaluationFormulaModifierEffect:
    operation: AugmentationOperation
    value: Formula
    selector: FormulaModifierSelector = field(default_factory=FormulaModifierSelector)
    type: Literal["evaluation_formula_modifier"] = "evaluation_formula_modifier"

    @classmethod
    def from_dict(cls, raw: dict) -> "EvaluationFormulaModifierEffect":
        return cls(
            operation=raw["operation"],
            value=Formula.from_dict(raw["value"]),
            selector=FormulaModifierSelector.from_dict(raw.get("selector")),
        )


@dataclass
class RollModeModifierEffect:
    roll_mode: RollMode
    selector: FormulaModifierSelector = field(default_factory=FormulaModifierSelector)
    type: Literal["roll_mode_modifier"] = "roll_mode_modifier"

    @classmethod
    def from_dict(cls, raw: dict) -> "RollModeModifierEffect":
        return cls(
            roll_mode=raw["roll_mode"],
            selector=FormulaModifierSelector.from_dict(raw.get("selector")),
        )


AugmentationEffect = (
    FormulaModifierEffect | EvaluationFormulaModifierEffect | RollModeModifierEffect
)


def augmentation_effect_from_dict(raw: dict) -> AugmentationEffect:
    effect_types = {
        "formula_modifier": FormulaModifierEffect,
        "evaluation_formula_modifier": EvaluationFormulaModifierEffect,
        "roll_mode_modifier": RollModeModifierEffect,
    }
    effect_type = raw.get("type")
    effect_model = effect_types.get(effect_type)
    if effect_model is None:
        raise ValueError(f"Unsupported augmentation effect type '{effect_type}'.")
    return effect_model.from_dict(raw)


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
    lifecycle_owner: AugmentationLifecycleOwner = "manual"
    lifecycle: AugmentationLifecycle = field(default_factory=AugmentationLifecycle)

    @classmethod
    def from_dict(cls, raw: dict) -> "Augmentation":
        return cls(
            id=raw["id"],
            name=raw["name"],
            description=raw.get("description", ""),
            source=AugmentationSource.from_dict(raw["source"]),
            scope=raw["scope"],
            target=AugmentationTarget.from_dict(raw["target"]),
            effect=augmentation_effect_from_dict(raw["effect"]),
            active=raw.get("active", True),
            applied=raw.get("applied", False),
            applied_target_id=raw.get("applied_target_id"),
            lifecycle_owner=raw.get("lifecycle_owner", "manual"),
            lifecycle=AugmentationLifecycle.from_dict(raw.get("lifecycle")),
        )


@dataclass
class StandaloneEffectDefinition:
    id: str
    name: str
    scope: AugmentationScope
    target: AugmentationTarget
    effect: AugmentationEffect
    description: str = ""
    active: bool = True
    lifecycle: AugmentationLifecycle = field(default_factory=AugmentationLifecycle)

    @classmethod
    def from_dict(cls, raw: dict) -> "StandaloneEffectDefinition":
        return cls(
            id=raw["id"],
            name=raw["name"],
            description=raw.get("description", ""),
            scope=raw["scope"],
            target=AugmentationTarget.from_dict(raw["target"]),
            effect=augmentation_effect_from_dict(raw["effect"]),
            active=raw.get("active", True),
            lifecycle=AugmentationLifecycle.from_dict(raw.get("lifecycle")),
        )


@dataclass
class StandaloneEffectApplication:
    application_id: str
    definition_id: str
    instance_id: str
    source: AugmentationSource
    active: bool = True

    @classmethod
    def from_dict(cls, raw: dict) -> "StandaloneEffectApplication":
        return cls(
            application_id=raw["application_id"],
            definition_id=raw["definition_id"],
            instance_id=raw["instance_id"],
            source=AugmentationSource.from_dict(raw["source"]),
            active=raw.get("active", True),
        )


@dataclass
class EquipmentEffectProjection:
    target_path: str
    base_value: int | float
    effective_value: int | float

    @classmethod
    def from_dict(cls, raw: dict) -> "EquipmentEffectProjection":
        return cls(
            target_path=raw["target_path"],
            base_value=raw["base_value"],
            effective_value=raw["effective_value"],
        )
