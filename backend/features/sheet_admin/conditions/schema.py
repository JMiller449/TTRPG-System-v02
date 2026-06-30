from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from backend.core.transport import RequestModel
from backend.protocol.state_schema import AugmentationPayload


class ConditionPresetPayload(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    description: str = ""
    visibility: Literal["public", "gm_only"] = "public"
    augmentation_ids: list[str] = Field(default_factory=list)
    augmentation_templates: list[AugmentationPayload] = Field(default_factory=list)


class CreateConditionPreset(RequestModel):
    condition: ConditionPresetPayload
    type: Literal["create_condition_preset"]


class UpdateConditionPreset(RequestModel):
    condition_id: str = Field(min_length=1)
    condition_partial: dict
    type: Literal["update_condition_preset"]


class DeleteConditionPreset(RequestModel):
    condition_id: str = Field(min_length=1)
    type: Literal["delete_condition_preset"]


class RemoveActiveCondition(RequestModel):
    instance_id: str = Field(min_length=1)
    application_id: str = Field(min_length=1)
    type: Literal["remove_active_condition"]
