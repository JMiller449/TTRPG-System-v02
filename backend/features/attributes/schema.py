from __future__ import annotations

from typing import Literal

from pydantic import Field

from backend.core.transport import RequestModel
from backend.features.attributes.value_schema import AttributeDefinitionPayload, AttributeValuePayload


class CreateAttribute(RequestModel):
    attribute: AttributeDefinitionPayload
    type: Literal["create_attribute"]


class UpdateAttribute(RequestModel):
    attribute_id: str = Field(min_length=1)
    attribute: AttributeDefinitionPayload
    type: Literal["update_attribute"]


class DeleteAttribute(RequestModel):
    attribute_id: str = Field(min_length=1)
    type: Literal["delete_attribute"]


class AttachSheetAttribute(RequestModel):
    sheet_id: str = Field(min_length=1)
    relationship_id: str = Field(min_length=1)
    attribute_id: str = Field(min_length=1)
    value: AttributeValuePayload | None = None
    type: Literal["attach_sheet_attribute"]


class DetachSheetAttribute(RequestModel):
    sheet_id: str = Field(min_length=1)
    attribute_id: str = Field(min_length=1)
    type: Literal["detach_sheet_attribute"]


class AttachSubjectAttribute(RequestModel):
    subject_type: Literal["item", "action"]
    subject_id: str = Field(min_length=1)
    relationship_id: str = Field(min_length=1)
    attribute_id: str = Field(min_length=1)
    value: AttributeValuePayload | None = None
    type: Literal["attach_subject_attribute"]


class SetSubjectAttributeValue(RequestModel):
    subject_type: Literal["item", "action"]
    subject_id: str = Field(min_length=1)
    attribute_id: str = Field(min_length=1)
    value: AttributeValuePayload
    type: Literal["set_subject_attribute_value"]


class ResetSubjectAttributeValue(RequestModel):
    subject_type: Literal["item", "action"]
    subject_id: str = Field(min_length=1)
    attribute_id: str = Field(min_length=1)
    type: Literal["reset_subject_attribute_value"]


class DetachSubjectAttribute(RequestModel):
    subject_type: Literal["item", "action"]
    subject_id: str = Field(min_length=1)
    attribute_id: str = Field(min_length=1)
    type: Literal["detach_subject_attribute"]


class SetSheetAttributeValue(RequestModel):
    sheet_id: str = Field(min_length=1)
    attribute_id: str = Field(min_length=1)
    value: AttributeValuePayload
    type: Literal["set_sheet_attribute_value"]


class ResetSheetAttributeValue(RequestModel):
    sheet_id: str = Field(min_length=1)
    attribute_id: str = Field(min_length=1)
    type: Literal["reset_sheet_attribute_value"]
