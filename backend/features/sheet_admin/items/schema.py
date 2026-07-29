from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from backend.core.transport import RequestModel
from backend.features.attributes.value_schema import AttributeBridgePayload
from backend.protocol.state_schema import AugmentationPayload


class ItemActionGrantPayload(BaseModel):
    action_id: str = Field(min_length=1)
    availability: Literal["carried", "equipped"]
    consume_quantity: int = Field(default=0, ge=0)


class ItemPlayerCatalogAccessPayload(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")

    mode: Literal["none", "all", "selected"] = "none"
    instance_ids: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_access(self) -> "ItemPlayerCatalogAccessPayload":
        if any(not instance_id for instance_id in self.instance_ids):
            raise ValueError("Player catalog instance IDs cannot be blank.")
        if len(self.instance_ids) != len(set(self.instance_ids)):
            raise ValueError("Player catalog instance IDs must be unique.")
        if self.mode != "selected" and self.instance_ids:
            raise ValueError(
                "Only selected player catalog access can contain instance IDs."
            )
        return self


class ItemDefinitionPayload(BaseModel):
    model_config = ConfigDict(strict=True)

    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    interaction_type: Literal["equippable", "consumable", "inventory_only"]
    rank: str = ""
    description: str = ""
    world_anvil_url: str = ""
    gm_notes: str = ""
    gm_special_properties: str = ""
    price: str = ""
    weight: float = Field(default=0, ge=0, allow_inf_nan=False)
    player_catalog_access: ItemPlayerCatalogAccessPayload = Field(
        default_factory=ItemPlayerCatalogAccessPayload
    )
    can_contain_items: bool = False
    storage_capacity_weight: float | None = Field(
        default=None,
        ge=0,
        allow_inf_nan=False,
    )
    contents_weight_behavior: Literal["normal", "ignored"] = "normal"
    tags: list[str] = Field(default_factory=list)
    attributes: dict[str, AttributeBridgePayload] = Field(default_factory=dict)
    augmentation_templates: list[AugmentationPayload] = Field(default_factory=list)
    action_grants: list[ItemActionGrantPayload] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_item_type(self) -> "ItemDefinitionPayload":
        action_ids = [grant.action_id for grant in self.action_grants]
        if len(action_ids) != len(set(action_ids)):
            raise ValueError("Item action grants must use unique action IDs.")

        if self.interaction_type == "inventory_only":
            if self.augmentation_templates:
                raise ValueError("Inventory-only items cannot have augmentations.")
            if self.action_grants:
                raise ValueError("Inventory-only items cannot grant actions.")

        if not self.can_contain_items and (
            self.contents_weight_behavior != "normal"
            or self.storage_capacity_weight is not None
        ):
            raise ValueError(
                "Only storage containers can define capacity or change how stored "
                "weight counts."
            )

        if self.interaction_type == "consumable":
            if self.augmentation_templates:
                raise ValueError(
                    "Consumable items must apply effects through their carried actions, "
                    "not item augmentation templates."
                )
            if any(grant.availability != "carried" for grant in self.action_grants):
                raise ValueError("Consumable item actions must use carried availability.")
            if not any(grant.consume_quantity > 0 for grant in self.action_grants):
                raise ValueError(
                    "Consumable items require at least one carried action that consumes "
                    "a positive quantity."
                )
        return self


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


class CreateItemTemplate(RequestModel):
    template: ItemDefinitionPayload
    type: Literal["create_item_template"]


class UpdateItemTemplate(RequestModel):
    template_id: str = Field(min_length=1)
    template: ItemDefinitionPayload
    type: Literal["update_item_template"]


class DeleteItemTemplate(RequestModel):
    template_id: str = Field(min_length=1)
    type: Literal["delete_item_template"]


class AddPlayerInventoryItem(RequestModel):
    item_id: str = Field(min_length=1)
    type: Literal["add_player_inventory_item"]


class RemovePlayerInventoryItem(RequestModel):
    relationship_id: str = Field(min_length=1)
    type: Literal["remove_player_inventory_item"]


class PlayerItemSubmissionPayload(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")

    name: str = Field(min_length=1)
    interaction_type: Literal["equippable", "inventory_only"] = "inventory_only"
    rank: str = ""
    description: str = ""
    world_anvil_url: str = ""
    price: str = ""
    weight: float = Field(default=0, ge=0, allow_inf_nan=False)
    can_contain_items: bool = False
    storage_capacity_weight: float | None = Field(
        default=None,
        ge=0,
        allow_inf_nan=False,
    )

    @model_validator(mode="after")
    def validate_name(self) -> "PlayerItemSubmissionPayload":
        if not self.name.strip():
            raise ValueError("Item name cannot be blank.")
        return self


class SubmitPlayerItem(RequestModel):
    item: PlayerItemSubmissionPayload
    type: Literal["submit_player_item"]


class ReviewPlayerItem(RequestModel):
    item_id: str = Field(min_length=1)
    approved: bool
    type: Literal["review_player_item"]


class UpsertItemAugmentationTemplate(RequestModel):
    item_id: str = Field(min_length=1)
    augmentation: AugmentationPayload
    type: Literal["upsert_item_augmentation_template"]


class RemoveItemAugmentationTemplate(RequestModel):
    item_id: str = Field(min_length=1)
    augmentation_id: str = Field(min_length=1)
    type: Literal["remove_item_augmentation_template"]
