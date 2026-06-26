from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field, model_validator

from backend.core.transport import RequestModel
from backend.features.sheet_admin.formulas.schema import FormulaPayload
from backend.state.models.damage import DamageType


class NumericBoundsPayload(BaseModel):
    min_value: FormulaPayload | None = None
    max_value: FormulaPayload | None = None
    on_min_violation: Literal["clamp", "reject"] = "clamp"
    on_max_violation: Literal["clamp", "reject"] = "clamp"


class SendMessageActionStepPayload(BaseModel):
    step_id: str = Field(min_length=1)
    type: Literal["send_message"]
    message: FormulaPayload


class SetValueActionStepPayload(NumericBoundsPayload):
    step_id: str = Field(min_length=1)
    type: Literal["set_value"]
    target: Literal["caster", "target"] = "caster"
    path: list[str] = Field(min_length=1)
    value: FormulaPayload


class IncrementValueActionStepPayload(NumericBoundsPayload):
    step_id: str = Field(min_length=1)
    type: Literal["increment_value"]
    target: Literal["caster", "target"] = "caster"
    path: list[str] = Field(min_length=1)
    amount: FormulaPayload


class DecrementValueActionStepPayload(NumericBoundsPayload):
    step_id: str = Field(min_length=1)
    type: Literal["decrement_value"]
    target: Literal["caster", "target"] = "caster"
    path: list[str] = Field(min_length=1)
    amount: FormulaPayload


class ResolveDamageActionStepPayload(BaseModel):
    step_id: str = Field(min_length=1)
    type: Literal["resolve_damage"]
    target: Literal["caster", "target"] = "caster"
    damage_type: DamageType
    amount: FormulaPayload


class GainProficiencyUseActionStepPayload(BaseModel):
    step_id: str = Field(min_length=1)
    type: Literal["gain_proficiency_use"]
    target: Literal["caster", "target"] = "caster"
    proficiency_id: str = Field(min_length=1)
    amount: FormulaPayload


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
    notes: str = ""
    steps: list[ActionStepPayload] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_unique_step_ids(self) -> "ActionDefinitionPayload":
        seen_step_ids: set[str] = set()
        duplicate_step_ids: list[str] = []
        for step in self.steps:
            if step.step_id in seen_step_ids:
                duplicate_step_ids.append(step.step_id)
                continue
            seen_step_ids.add(step.step_id)

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
