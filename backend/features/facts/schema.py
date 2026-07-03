from __future__ import annotations

from typing import Literal

from pydantic import Field

from backend.core.transport import RequestModel
from backend.features.facts.value_schema import FactDefinitionPayload, FactValuePayload


class CreateFact(RequestModel):
    fact: FactDefinitionPayload
    type: Literal["create_fact"]


class UpdateFact(RequestModel):
    fact_id: str = Field(min_length=1)
    fact: FactDefinitionPayload
    type: Literal["update_fact"]


class DeleteFact(RequestModel):
    fact_id: str = Field(min_length=1)
    type: Literal["delete_fact"]


class AttachSheetFact(RequestModel):
    sheet_id: str = Field(min_length=1)
    relationship_id: str = Field(min_length=1)
    fact_id: str = Field(min_length=1)
    value: FactValuePayload | None = None
    type: Literal["attach_sheet_fact"]


class DetachSheetFact(RequestModel):
    sheet_id: str = Field(min_length=1)
    fact_id: str = Field(min_length=1)
    type: Literal["detach_sheet_fact"]


class AttachSubjectFact(RequestModel):
    subject_type: Literal["item", "action"]
    subject_id: str = Field(min_length=1)
    relationship_id: str = Field(min_length=1)
    fact_id: str = Field(min_length=1)
    value: FactValuePayload | None = None
    type: Literal["attach_subject_fact"]


class SetSubjectFactValue(RequestModel):
    subject_type: Literal["item", "action"]
    subject_id: str = Field(min_length=1)
    fact_id: str = Field(min_length=1)
    value: FactValuePayload
    type: Literal["set_subject_fact_value"]


class ResetSubjectFactValue(RequestModel):
    subject_type: Literal["item", "action"]
    subject_id: str = Field(min_length=1)
    fact_id: str = Field(min_length=1)
    type: Literal["reset_subject_fact_value"]


class DetachSubjectFact(RequestModel):
    subject_type: Literal["item", "action"]
    subject_id: str = Field(min_length=1)
    fact_id: str = Field(min_length=1)
    type: Literal["detach_subject_fact"]


class SetSheetFactValue(RequestModel):
    sheet_id: str = Field(min_length=1)
    fact_id: str = Field(min_length=1)
    value: FactValuePayload
    type: Literal["set_sheet_fact_value"]


class ResetSheetFactValue(RequestModel):
    sheet_id: str = Field(min_length=1)
    fact_id: str = Field(min_length=1)
    type: Literal["reset_sheet_fact_value"]
