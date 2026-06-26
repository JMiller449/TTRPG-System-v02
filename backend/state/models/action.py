from dataclasses import dataclass, field
from typing import Literal

from backend.state.models.damage import DamageType, ensure_damage_type
from backend.state.models.formula import Formula

ActionStepTarget = Literal["caster", "target"]
BoundsViolationMode = Literal["clamp", "reject"]


def _formula_or_none(raw: dict, key: str) -> Formula | None:
    value = raw.get(key)
    if value is None:
        return None
    return Formula.from_dict(value)


@dataclass
class SendMessageStep:
    step_id: str
    message: Formula
    type: Literal["send_message"] = "send_message"

    @classmethod
    def from_dict(cls, raw: dict) -> "SendMessageStep":
        return cls(
            step_id=raw["step_id"],
            message=Formula.from_dict(raw["message"]),
        )


@dataclass
class SetValueStep:
    step_id: str
    path: list[str]
    value: Formula
    min_value: Formula | None = None
    max_value: Formula | None = None
    on_min_violation: BoundsViolationMode = "clamp"
    on_max_violation: BoundsViolationMode = "clamp"
    target: ActionStepTarget = "caster"
    type: Literal["set_value"] = "set_value"

    @classmethod
    def from_dict(cls, raw: dict) -> "SetValueStep":
        return cls(
            step_id=raw["step_id"],
            path=list(raw["path"]),
            value=Formula.from_dict(raw["value"]),
            min_value=_formula_or_none(raw, "min_value"),
            max_value=_formula_or_none(raw, "max_value"),
            on_min_violation=raw.get("on_min_violation", "clamp"),
            on_max_violation=raw.get("on_max_violation", "clamp"),
            target=raw.get("target", "caster"),
        )


@dataclass
class IncrementValueStep:
    step_id: str
    path: list[str]
    amount: Formula
    min_value: Formula | None = None
    max_value: Formula | None = None
    on_min_violation: BoundsViolationMode = "clamp"
    on_max_violation: BoundsViolationMode = "clamp"
    target: ActionStepTarget = "caster"
    type: Literal["increment_value"] = "increment_value"

    @classmethod
    def from_dict(cls, raw: dict) -> "IncrementValueStep":
        return cls(
            step_id=raw["step_id"],
            path=list(raw["path"]),
            amount=Formula.from_dict(raw["amount"]),
            min_value=_formula_or_none(raw, "min_value"),
            max_value=_formula_or_none(raw, "max_value"),
            on_min_violation=raw.get("on_min_violation", "clamp"),
            on_max_violation=raw.get("on_max_violation", "clamp"),
            target=raw.get("target", "caster"),
        )


@dataclass
class DecrementValueStep:
    step_id: str
    path: list[str]
    amount: Formula
    min_value: Formula | None = None
    max_value: Formula | None = None
    on_min_violation: BoundsViolationMode = "clamp"
    on_max_violation: BoundsViolationMode = "clamp"
    target: ActionStepTarget = "caster"
    type: Literal["decrement_value"] = "decrement_value"

    @classmethod
    def from_dict(cls, raw: dict) -> "DecrementValueStep":
        return cls(
            step_id=raw["step_id"],
            path=list(raw["path"]),
            amount=Formula.from_dict(raw["amount"]),
            min_value=_formula_or_none(raw, "min_value"),
            max_value=_formula_or_none(raw, "max_value"),
            on_min_violation=raw.get("on_min_violation", "clamp"),
            on_max_violation=raw.get("on_max_violation", "clamp"),
            target=raw.get("target", "caster"),
        )


@dataclass
class ResolveDamageStep:
    step_id: str
    damage_type: DamageType
    amount: Formula
    target: ActionStepTarget = "caster"
    type: Literal["resolve_damage"] = "resolve_damage"

    @classmethod
    def from_dict(cls, raw: dict) -> "ResolveDamageStep":
        return cls(
            step_id=raw["step_id"],
            damage_type=ensure_damage_type(raw["damage_type"]),
            amount=Formula.from_dict(raw["amount"]),
            target=raw.get("target", "caster"),
        )


@dataclass
class GainProficiencyUseStep:
    step_id: str
    proficiency_id: str
    amount: Formula
    target: ActionStepTarget = "caster"
    type: Literal["gain_proficiency_use"] = "gain_proficiency_use"

    @classmethod
    def from_dict(cls, raw: dict) -> "GainProficiencyUseStep":
        return cls(
            step_id=raw["step_id"],
            proficiency_id=raw["proficiency_id"],
            amount=Formula.from_dict(raw["amount"]),
            target=raw.get("target", "caster"),
        )


@dataclass
class ApplyAugmentationStep:
    step_id: str
    augmentation_id: str
    operation: Literal["apply", "remove"] = "apply"
    target: ActionStepTarget = "caster"
    type: Literal["apply_augmentation"] = "apply_augmentation"

    @classmethod
    def from_dict(cls, raw: dict) -> "ApplyAugmentationStep":
        return cls(
            step_id=raw["step_id"],
            augmentation_id=raw["augmentation_id"],
            operation=raw.get("operation", "apply"),
            target=raw.get("target", "caster"),
        )


@dataclass
class ApplyConditionPresetStep:
    step_id: str
    condition_id: str
    operation: Literal["apply", "remove"] = "apply"
    target: ActionStepTarget = "caster"
    type: Literal["apply_condition_preset"] = "apply_condition_preset"

    @classmethod
    def from_dict(cls, raw: dict) -> "ApplyConditionPresetStep":
        return cls(
            step_id=raw["step_id"],
            condition_id=raw["condition_id"],
            operation=raw.get("operation", "apply"),
            target=raw.get("target", "caster"),
        )


ActionStep = (
    SendMessageStep
    | SetValueStep
    | IncrementValueStep
    | DecrementValueStep
    | ResolveDamageStep
    | GainProficiencyUseStep
    | ApplyAugmentationStep
    | ApplyConditionPresetStep
)


@dataclass
class Action:
    id: str
    name: str
    notes: str = ""
    steps: list[ActionStep] = field(default_factory=list)

    @classmethod
    def from_dict(cls, raw: dict) -> "Action":
        steps: list[ActionStep] = []
        for raw_step in raw.get("steps", []):
            step_type = raw_step["type"]
            if step_type == "send_message":
                steps.append(SendMessageStep.from_dict(raw_step))
                continue
            if step_type == "set_value":
                steps.append(SetValueStep.from_dict(raw_step))
                continue
            if step_type == "increment_value":
                steps.append(IncrementValueStep.from_dict(raw_step))
                continue
            if step_type == "decrement_value":
                steps.append(DecrementValueStep.from_dict(raw_step))
                continue
            if step_type == "resolve_damage":
                steps.append(ResolveDamageStep.from_dict(raw_step))
                continue
            if step_type == "gain_proficiency_use":
                steps.append(GainProficiencyUseStep.from_dict(raw_step))
                continue
            if step_type == "apply_augmentation":
                steps.append(ApplyAugmentationStep.from_dict(raw_step))
                continue
            if step_type == "apply_condition_preset":
                steps.append(ApplyConditionPresetStep.from_dict(raw_step))
                continue
            raise ValueError(f"Unsupported action step type '{step_type}'.")

        return cls(
            id=raw["id"],
            name=raw["name"],
            notes=raw.get("notes", ""),
            steps=steps,
        )
