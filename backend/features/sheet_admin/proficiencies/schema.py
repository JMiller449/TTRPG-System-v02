from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from backend.core.transport import RequestModel
from backend.state.models.proficiency import ProficiencyCategory


class ProficiencyDefinitionPayload(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    description: str = ""
    category: ProficiencyCategory = "custom"
    default_growth_rate: float = Field(default=0.01, ge=0, allow_inf_nan=False)


class CreateProficiency(RequestModel):
    proficiency: ProficiencyDefinitionPayload
    type: Literal["create_proficiency"]


class UpdateProficiency(RequestModel):
    proficiency_id: str = Field(min_length=1)
    proficiency: ProficiencyDefinitionPayload
    type: Literal["update_proficiency"]


class DeleteProficiency(RequestModel):
    proficiency_id: str = Field(min_length=1)
    type: Literal["delete_proficiency"]
