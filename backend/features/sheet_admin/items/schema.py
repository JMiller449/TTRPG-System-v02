from __future__ import annotations

from pydantic import BaseModel, Field

from backend.features.sheet_admin.formulas.schema import FormulaPayload
from backend.state.models.stat import StatName


class StatAugmentationPayload(BaseModel):
    stat_name: StatName
    augmentation: FormulaPayload


class ItemDefinitionPayload(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    description: str = ""
    price: str = ""
    weight: str = ""
    stat_augmentations: list[StatAugmentationPayload] = Field(default_factory=list)
