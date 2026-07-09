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
    same_source_item: bool = False

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
            same_source_item=bool(raw.get("same_source_item", False)),
        )

    def matches(
        self,
        *,
        tags: list[str],
        action_id: str | None = None,
        formula_id: str | None = None,
        step_id: str | None = None,
        source_item_relationship_id: str | None = None,
        effect_source_item_relationship_id: str | None = None,
    ) -> bool:
        context_tags = set(normalize_formula_tags(tags))
        if not set(self.required_tags).issubset(context_tags):
            return False
        if set(self.excluded_tags) & context_tags:
            return False
        if self.same_source_item and (
            source_item_relationship_id is None
            or effect_source_item_relationship_id is None
            or source_item_relationship_id != effect_source_item_relationship_id
        ):
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


LifecycleMode = Literal[
    "manual",
    "rounds",
    "turns",
    "until_rest",
    "until_source_removed",
    "scene",
]


@dataclass
class AugmentationLifecycle:
    # Declarative authoring intent. The backend does NOT run a turn/round/rest engine — that
    # is an explicit product non-goal — so `rounds`/`turns`/`until_rest`/`scene` and `remaining`
    # are GM-tracked labels surfaced in the UI, not auto-executed. The only lifecycle behaviour
    # actually enforced today is source-linked teardown (equipment unequip / condition removal),
    # which the equipment/condition derive logic already performs regardless of these fields;
    # `remove_when_source_inactive` documents that intent for other sources.
    mode: LifecycleMode = "manual"
    remaining: int | None = None
    expires_at: str | None = None
    remove_when_source_inactive: bool = False
    notes: str | None = None

    @classmethod
    def from_dict(cls, raw: dict | None) -> "AugmentationLifecycle":
        if raw is None:
            return cls()
        return cls(
            mode=raw.get("mode", "manual"),
            remaining=raw.get("remaining"),
            expires_at=raw.get("expires_at"),
            remove_when_source_inactive=bool(
                raw.get("remove_when_source_inactive", False)
            ),
            notes=raw.get("notes"),
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


StackingMode = Literal["unique", "stack"]


@dataclass
class StackingConfig:
    # unique: at most one active application per definition per instance (reapply is a no-op).
    # stack: multiple concurrent applications whose effects accumulate, capped by max_stacks
    #        (None = unlimited). Removal clears the whole stack for that definition/instance.
    mode: StackingMode = "unique"
    max_stacks: int | None = None

    @classmethod
    def from_dict(cls, raw: dict | None) -> "StackingConfig":
        if raw is None:
            return cls()
        return cls(
            mode=raw.get("mode", "unique"),
            max_stacks=raw.get("max_stacks"),
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
    stacking: StackingConfig = field(default_factory=StackingConfig)

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
            stacking=StackingConfig.from_dict(raw.get("stacking")),
        )


@dataclass
class StandaloneEffectApplication:
    application_id: str
    definition_id: str
    instance_id: str
    source: AugmentationSource
    active: bool = True
    stack_index: int = 0

    @classmethod
    def from_dict(cls, raw: dict) -> "StandaloneEffectApplication":
        return cls(
            application_id=raw["application_id"],
            definition_id=raw["definition_id"],
            instance_id=raw["instance_id"],
            source=AugmentationSource.from_dict(raw["source"]),
            stack_index=raw.get("stack_index", 0),
            active=raw.get("active", True),
        )


@dataclass
class DirectEffectProjection:
    target_path: str
    base_value: int | float
    effective_value: int | float

    @classmethod
    def from_dict(cls, raw: dict) -> "DirectEffectProjection":
        return cls(
            target_path=raw["target_path"],
            base_value=raw["base_value"],
            effective_value=raw["effective_value"],
        )
