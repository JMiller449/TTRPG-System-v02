from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from backend.core.transport import RequestModel
from backend.features.sheet_admin.formulas.schema import FormulaPayload
from backend.protocol.state_schema import AugmentationPayload
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
    augmentation_templates: list[AugmentationPayload] = Field(default_factory=list)


class CreateItem(RequestModel):
    item: ItemDefinitionPayload
    type: Literal["create_item"]


class UpdateItem(RequestModel):
    item_id: str = Field(min_length=1)
    item: ItemDefinitionPayload
    type: Literal["update_item"]


class DeleteItem(RequestModel):
    item_id: str = Field(min_length=1)
    type: Literal["delete_item"]


class UpsertItemAugmentationTemplate(RequestModel):
    item_id: str = Field(min_length=1)
    augmentation: AugmentationPayload
    type: Literal["upsert_item_augmentation_template"]


class RemoveItemAugmentationTemplate(RequestModel):
    item_id: str = Field(min_length=1)
    augmentation_id: str = Field(min_length=1)
    type: Literal["remove_item_augmentation_template"]
