import re
from dataclasses import dataclass, field
from typing import Literal

from backend.state.models.damage import DamageType, ensure_damage_type
from backend.state.models.formula import Formula
from backend.state.models.attribute import AttributeBridge

ActionStepTarget = Literal["caster", "target"]
BoundsViolationMode = Literal["clamp", "reject"]
ActionRollModeKind = Literal["none", "check", "damage"]
Roll20RollPresentation = Literal["simple", "damage", "default"]
_VARIABLE_ID_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _validate_variable_id(variable_id: str) -> None:
    if not _VARIABLE_ID_PATTERN.fullmatch(variable_id):
        raise ValueError(
            "Calculated value variable IDs must start with a letter or underscore "
            "and contain only letters, numbers, and underscores."
        )


@dataclass(frozen=True)
class CalculatedValueReference:
    variable_id: str
    type: Literal["calculated_value"] = "calculated_value"

    def __post_init__(self) -> None:
        _validate_variable_id(self.variable_id)

    @classmethod
    def from_dict(cls, raw: dict) -> "CalculatedValueReference":
        return cls(variable_id=raw["variable_id"])


@dataclass(frozen=True)
class FormulaReference:
    formula_id: str
    type: Literal["formula_reference"] = "formula_reference"

    def __post_init__(self) -> None:
        if not self.formula_id:
            raise ValueError("Formula reference IDs must not be empty.")

    @classmethod
    def from_dict(cls, raw: dict) -> "FormulaReference":
        return cls(formula_id=raw["formula_id"])


FormulaValueSource = Formula | FormulaReference
NumericValueSource = FormulaValueSource | CalculatedValueReference


def _formula_value_source(raw: dict) -> FormulaValueSource:
    if raw.get("type") == "formula_reference":
        return FormulaReference.from_dict(raw)
    return Formula.from_dict(raw)


def _numeric_value_source(raw: dict) -> NumericValueSource:
    if raw.get("type") == "calculated_value":
        return CalculatedValueReference.from_dict(raw)
    return _formula_value_source(raw)


def _numeric_value_or_none(raw: dict, key: str) -> NumericValueSource | None:
    value = raw.get(key)
    if value is None:
        return None
    return _numeric_value_source(value)


@dataclass
class SendMessageStep:
    step_id: str
    message: FormulaValueSource
    type: Literal["send_message"] = "send_message"

    @classmethod
    def from_dict(cls, raw: dict) -> "SendMessageStep":
        return cls(
            step_id=raw["step_id"],
            message=_formula_value_source(raw["message"]),
        )


@dataclass
class RollResult:
    label: str
    value: FormulaValueSource

    def __post_init__(self) -> None:
        if not self.label.strip():
            raise ValueError("Roll result labels must not be empty.")

    @classmethod
    def from_dict(cls, raw: dict) -> "RollResult":
        return cls(label=raw["label"], value=_formula_value_source(raw["value"]))


@dataclass
class SendRollStep:
    step_id: str
    title: str
    presentation: Roll20RollPresentation
    rolls: list[RollResult]
    type: Literal["send_roll"] = "send_roll"

    def __post_init__(self) -> None:
        if not self.title.strip():
            raise ValueError("Roll titles must not be empty.")
        if self.presentation not in ("simple", "damage", "default"):
            raise ValueError("Unsupported Roll20 roll presentation.")
        expected = (1, 1) if self.presentation == "simple" else (1, 2)
        if not expected[0] <= len(self.rolls) <= expected[1]:
            raise ValueError(
                f"'{self.presentation}' rolls require {expected[0]}"
                + (" result." if expected[0] == expected[1] else " or 2 results.")
            )

    @classmethod
    def from_dict(cls, raw: dict) -> "SendRollStep":
        return cls(
            step_id=raw["step_id"],
            title=raw["title"],
            presentation=raw.get("presentation", "default"),
            rolls=[RollResult.from_dict(value) for value in raw["rolls"]],
        )


@dataclass
class CalculateValueStep:
    step_id: str
    variable_id: str
    value: FormulaValueSource
    type: Literal["calculate_value"] = "calculate_value"

    def __post_init__(self) -> None:
        _validate_variable_id(self.variable_id)

    @classmethod
    def from_dict(cls, raw: dict) -> "CalculateValueStep":
        return cls(
            step_id=raw["step_id"],
            variable_id=raw["variable_id"],
            value=_formula_value_source(raw["value"]),
        )


@dataclass
class SetValueStep:
    step_id: str
    path: list[str]
    value: NumericValueSource
    min_value: NumericValueSource | None = None
    max_value: NumericValueSource | None = None
    on_min_violation: BoundsViolationMode = "clamp"
    on_max_violation: BoundsViolationMode = "clamp"
    target: ActionStepTarget = "caster"
    type: Literal["set_value"] = "set_value"

    @classmethod
    def from_dict(cls, raw: dict) -> "SetValueStep":
        return cls(
            step_id=raw["step_id"],
            path=list(raw["path"]),
            value=_numeric_value_source(raw["value"]),
            min_value=_numeric_value_or_none(raw, "min_value"),
            max_value=_numeric_value_or_none(raw, "max_value"),
            on_min_violation=raw.get("on_min_violation", "clamp"),
            on_max_violation=raw.get("on_max_violation", "clamp"),
            target=raw.get("target", "caster"),
        )


@dataclass
class IncrementValueStep:
    step_id: str
    path: list[str]
    amount: NumericValueSource
    min_value: NumericValueSource | None = None
    max_value: NumericValueSource | None = None
    on_min_violation: BoundsViolationMode = "clamp"
    on_max_violation: BoundsViolationMode = "clamp"
    target: ActionStepTarget = "caster"
    type: Literal["increment_value"] = "increment_value"

    @classmethod
    def from_dict(cls, raw: dict) -> "IncrementValueStep":
        return cls(
            step_id=raw["step_id"],
            path=list(raw["path"]),
            amount=_numeric_value_source(raw["amount"]),
            min_value=_numeric_value_or_none(raw, "min_value"),
            max_value=_numeric_value_or_none(raw, "max_value"),
            on_min_violation=raw.get("on_min_violation", "clamp"),
            on_max_violation=raw.get("on_max_violation", "clamp"),
            target=raw.get("target", "caster"),
        )


@dataclass
class DecrementValueStep:
    step_id: str
    path: list[str]
    amount: NumericValueSource
    min_value: NumericValueSource | None = None
    max_value: NumericValueSource | None = None
    on_min_violation: BoundsViolationMode = "clamp"
    on_max_violation: BoundsViolationMode = "clamp"
    target: ActionStepTarget = "caster"
    type: Literal["decrement_value"] = "decrement_value"

    @classmethod
    def from_dict(cls, raw: dict) -> "DecrementValueStep":
        return cls(
            step_id=raw["step_id"],
            path=list(raw["path"]),
            amount=_numeric_value_source(raw["amount"]),
            min_value=_numeric_value_or_none(raw, "min_value"),
            max_value=_numeric_value_or_none(raw, "max_value"),
            on_min_violation=raw.get("on_min_violation", "clamp"),
            on_max_violation=raw.get("on_max_violation", "clamp"),
            target=raw.get("target", "caster"),
        )


@dataclass
class ResolveDamageStep:
    step_id: str
    damage_type: DamageType
    amount: NumericValueSource
    target: ActionStepTarget = "caster"
    type: Literal["resolve_damage"] = "resolve_damage"

    @classmethod
    def from_dict(cls, raw: dict) -> "ResolveDamageStep":
        return cls(
            step_id=raw["step_id"],
            damage_type=ensure_damage_type(raw["damage_type"]),
            amount=_numeric_value_source(raw["amount"]),
            target=raw.get("target", "caster"),
        )


@dataclass
class GainProficiencyUseStep:
    step_id: str
    proficiency_id: str
    amount: NumericValueSource
    target: ActionStepTarget = "caster"
    type: Literal["gain_proficiency_use"] = "gain_proficiency_use"

    @classmethod
    def from_dict(cls, raw: dict) -> "GainProficiencyUseStep":
        return cls(
            step_id=raw["step_id"],
            proficiency_id=raw["proficiency_id"],
            amount=_numeric_value_source(raw["amount"]),
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
    | SendRollStep
    | CalculateValueStep
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
    roll_mode_kind: ActionRollModeKind = "none"
    notes: str = ""
    steps: list[ActionStep] = field(default_factory=list)
    attributes: dict[str, AttributeBridge] = field(default_factory=dict)

    def __post_init__(self) -> None:
        seen_step_ids: set[str] = set()
        available_variables: set[str] = set()
        for step in self.steps:
            if step.step_id in seen_step_ids:
                raise ValueError(f"Duplicate action step ID '{step.step_id}'.")
            seen_step_ids.add(step.step_id)

            formulas: list[Formula] = []
            numeric_values: list[NumericValueSource | None] = []
            if isinstance(step, SendMessageStep):
                if isinstance(step.message, Formula):
                    formulas.append(step.message)
            elif isinstance(step, SendRollStep):
                formulas.extend(
                    roll.value for roll in step.rolls if isinstance(roll.value, Formula)
                )
            elif isinstance(step, CalculateValueStep):
                if isinstance(step.value, Formula):
                    formulas.append(step.value)
            elif isinstance(step, SetValueStep):
                numeric_values.append(step.value)
            elif isinstance(
                step,
                (
                    IncrementValueStep,
                    DecrementValueStep,
                    ResolveDamageStep,
                    GainProficiencyUseStep,
                ),
            ):
                numeric_values.append(step.amount)
            if isinstance(step, SetValueStep | IncrementValueStep | DecrementValueStep):
                numeric_values.extend((step.min_value, step.max_value))

            for value in numeric_values:
                if isinstance(value, Formula):
                    formulas.append(value)
                elif (
                    isinstance(value, CalculatedValueReference)
                    and value.variable_id not in available_variables
                ):
                    raise ValueError(
                        f"Calculated value '{value.variable_id}' in step "
                        f"'{step.step_id}' is not defined by an earlier step."
                    )

            for formula in formulas:
                for alias in formula.aliases or []:
                    if not alias.path or alias.path[0] != "action_values":
                        continue
                    if len(alias.path) != 2 or alias.path[1] not in available_variables:
                        variable_id = alias.path[1] if len(alias.path) > 1 else ""
                        raise ValueError(
                            f"Action value '{variable_id}' in step '{step.step_id}' "
                            "is not defined by an earlier step."
                        )

            if isinstance(step, CalculateValueStep):
                if step.variable_id in available_variables:
                    raise ValueError(
                        f"Duplicate calculated value variable ID '{step.variable_id}'."
                    )
                available_variables.add(step.variable_id)

    def referenced_formula_ids(self) -> set[str]:
        formula_ids: set[str] = set()
        for step in self.steps:
            values: list[FormulaValueSource | NumericValueSource | None] = []
            if isinstance(step, SendMessageStep):
                values.append(step.message)
            elif isinstance(step, SendRollStep):
                values.extend(roll.value for roll in step.rolls)
            elif isinstance(step, CalculateValueStep):
                values.append(step.value)
            elif isinstance(step, SetValueStep):
                values.extend((step.value, step.min_value, step.max_value))
            elif isinstance(
                step,
                (
                    IncrementValueStep,
                    DecrementValueStep,
                    ResolveDamageStep,
                    GainProficiencyUseStep,
                ),
            ):
                values.append(step.amount)
                if isinstance(step, IncrementValueStep | DecrementValueStep):
                    values.extend((step.min_value, step.max_value))
            formula_ids.update(
                value.formula_id
                for value in values
                if isinstance(value, FormulaReference)
            )
        return formula_ids

    @classmethod
    def from_dict(cls, raw: dict) -> "Action":
        raw_attributes = raw.get("attributes", raw.get("facts", {}))
        steps: list[ActionStep] = []
        for raw_step in raw.get("steps", []):
            step_type = raw_step["type"]
            if step_type == "send_message":
                steps.append(SendMessageStep.from_dict(raw_step))
                continue
            if step_type == "send_roll":
                steps.append(SendRollStep.from_dict(raw_step))
                continue
            if step_type == "calculate_value":
                steps.append(CalculateValueStep.from_dict(raw_step))
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
            roll_mode_kind=raw.get("roll_mode_kind", "none"),
            notes=raw.get("notes", ""),
            steps=steps,
            attributes={
                key: AttributeBridge.from_dict(bridge)
                for key, bridge in raw_attributes.items()
            },
        )
