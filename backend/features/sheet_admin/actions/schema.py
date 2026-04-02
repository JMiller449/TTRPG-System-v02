from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field, model_validator

from backend.features.sheet_admin.formulas.schema import FormulaPayload


class SendMessageActionStepPayload(BaseModel):
    step_id: str = Field(min_length=1)
    type: Literal["send_message"]
    message: FormulaPayload


class SetValueActionStepPayload(BaseModel):
    step_id: str = Field(min_length=1)
    type: Literal["set_value"]
    target: Literal["caster", "target"] = "caster"
    path: list[str] = Field(min_length=1)
    value: FormulaPayload


ActionStepPayload = Annotated[
    SendMessageActionStepPayload | SetValueActionStepPayload,
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
