from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field, model_validator

from backend.core.transport import RequestModel
from backend.features.sheet_admin.formulas.schema import FormulaPayload
from backend.state.models.damage import DamageType


class CalculatedValueReferencePayload(BaseModel):
    variable_id: str = Field(min_length=1, pattern=r"^[A-Za-z_][A-Za-z0-9_]*$")
    type: Literal["calculated_value"]


NumericValuePayload = FormulaPayload | CalculatedValueReferencePayload


class NumericBoundsPayload(BaseModel):
    min_value: NumericValuePayload | None = None
    max_value: NumericValuePayload | None = None
    on_min_violation: Literal["clamp", "reject"] = "clamp"
    on_max_violation: Literal["clamp", "reject"] = "clamp"


class SendMessageActionStepPayload(BaseModel):
    step_id: str = Field(min_length=1)
    type: Literal["send_message"]
    message: FormulaPayload


class CalculateValueActionStepPayload(BaseModel):
    step_id: str = Field(min_length=1)
    variable_id: str = Field(min_length=1, pattern=r"^[A-Za-z_][A-Za-z0-9_]*$")
    value: FormulaPayload
    type: Literal["calculate_value"]


class SetValueActionStepPayload(NumericBoundsPayload):
    step_id: str = Field(min_length=1)
    type: Literal["set_value"]
    target: Literal["caster", "target"] = "caster"
    path: list[str] = Field(min_length=1)
    value: NumericValuePayload


class IncrementValueActionStepPayload(NumericBoundsPayload):
    step_id: str = Field(min_length=1)
    type: Literal["increment_value"]
    target: Literal["caster", "target"] = "caster"
    path: list[str] = Field(min_length=1)
    amount: NumericValuePayload


class DecrementValueActionStepPayload(NumericBoundsPayload):
    step_id: str = Field(min_length=1)
    type: Literal["decrement_value"]
    target: Literal["caster", "target"] = "caster"
    path: list[str] = Field(min_length=1)
    amount: NumericValuePayload


class ResolveDamageActionStepPayload(BaseModel):
    step_id: str = Field(min_length=1)
    type: Literal["resolve_damage"]
    target: Literal["caster", "target"] = "caster"
    damage_type: DamageType
    amount: NumericValuePayload


class GainProficiencyUseActionStepPayload(BaseModel):
    step_id: str = Field(min_length=1)
    type: Literal["gain_proficiency_use"]
    target: Literal["caster", "target"] = "caster"
    proficiency_id: str = Field(min_length=1)
    amount: NumericValuePayload


class ApplyAugmentationActionStepPayload(BaseModel):
    step_id: str = Field(min_length=1)
    type: Literal["apply_augmentation"]
    target: Literal["caster", "target"] = "caster"
    augmentation_id: str = Field(min_length=1)
    operation: Literal["apply", "remove"] = "apply"


class ApplyConditionPresetActionStepPayload(BaseModel):
    step_id: str = Field(min_length=1)
    type: Literal["apply_condition_preset"]
    target: Literal["caster", "target"] = "caster"
    condition_id: str = Field(min_length=1)
    operation: Literal["apply", "remove"] = "apply"


ActionStepPayload = Annotated[
    SendMessageActionStepPayload
    | CalculateValueActionStepPayload
    | SetValueActionStepPayload
    | IncrementValueActionStepPayload
    | DecrementValueActionStepPayload
    | ResolveDamageActionStepPayload
    | GainProficiencyUseActionStepPayload
    | ApplyAugmentationActionStepPayload
    | ApplyConditionPresetActionStepPayload,
    Field(discriminator="type"),
]


class ActionDefinitionPayload(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    roll_mode_kind: Literal["none", "check", "damage"] = "none"
    notes: str = ""
    steps: list[ActionStepPayload] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_step_ids_and_calculated_value_references(
        self,
    ) -> "ActionDefinitionPayload":
        seen_step_ids: set[str] = set()
        duplicate_step_ids: list[str] = []
        available_variables: set[str] = set()
        for step in self.steps:
            if step.step_id in seen_step_ids:
                duplicate_step_ids.append(step.step_id)
                continue
            seen_step_ids.add(step.step_id)

            formulas: list[FormulaPayload] = []
            numeric_values: list[NumericValuePayload | None] = []
            if isinstance(step, SendMessageActionStepPayload):
                formulas.append(step.message)
            if isinstance(step, CalculateValueActionStepPayload):
                formulas.append(step.value)
            if isinstance(step, SetValueActionStepPayload):
                numeric_values.append(step.value)
            if isinstance(
                step,
                (
                    IncrementValueActionStepPayload,
                    DecrementValueActionStepPayload,
                    ResolveDamageActionStepPayload,
                    GainProficiencyUseActionStepPayload,
                ),
            ):
                numeric_values.append(step.amount)
            if isinstance(step, NumericBoundsPayload):
                numeric_values.extend((step.min_value, step.max_value))

            for value in numeric_values:
                if isinstance(value, FormulaPayload):
                    formulas.append(value)
                elif (
                    isinstance(value, CalculatedValueReferencePayload)
                    and value.variable_id not in available_variables
                ):
                    raise ValueError(
                        "Calculated value reference "
                        f"'{value.variable_id}' in step '{step.step_id}' must refer "
                        "to an earlier calculate_value step."
                    )

            for formula in formulas:
                for alias in formula.aliases or []:
                    if not alias.path or alias.path[0] != "action_values":
                        continue
                    if len(alias.path) != 2 or alias.path[1] not in available_variables:
                        variable_id = alias.path[1] if len(alias.path) > 1 else ""
                        raise ValueError(
                            "Action-value formula alias "
                            f"'{alias.name}' in step '{step.step_id}' references "
                            f"unavailable variable '{variable_id}'."
                        )

            if isinstance(step, CalculateValueActionStepPayload):
                if step.variable_id in available_variables:
                    raise ValueError(
                        "Calculate value variable IDs must be unique. Duplicate "
                        f"variable ID: {step.variable_id}"
                    )
                available_variables.add(step.variable_id)

        if duplicate_step_ids:
            duplicates = ", ".join(sorted(set(duplicate_step_ids)))
            raise ValueError(
                f"Action step IDs must be unique. Duplicate step IDs: {duplicates}"
            )
        return self


class CreateAction(RequestModel):
    action: ActionDefinitionPayload
    type: Literal["create_action"]


class UpdateAction(RequestModel):
    action_id: str = Field(min_length=1)
    action: ActionDefinitionPayload
    type: Literal["update_action"]


class DeleteAction(RequestModel):
    action_id: str = Field(min_length=1)
    type: Literal["delete_action"]
