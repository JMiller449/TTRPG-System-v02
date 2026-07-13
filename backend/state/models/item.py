from dataclasses import dataclass, field
from math import isfinite
from typing import List, Literal

from backend.state.models.augmentation import Augmentation
from backend.state.models.attribute import AttributeBridge, AttributeProfile


@dataclass
class ItemBridge:
    relationship_id: str
    count: int
    equipped: bool
    item_id: str
    parent_container_id: str | None = None

    @classmethod
    def from_dict(cls, raw: dict) -> "ItemBridge":
        return cls(
            relationship_id=raw["relationship_id"],
            count=raw["count"],
            equipped=raw.get("equipped", raw.get("active", False)),
            item_id=raw["item_id"],
            parent_container_id=raw.get("parent_container_id"),
        )


@dataclass(frozen=True)
class ItemActionGrant:
    action_id: str
    availability: Literal["carried", "equipped"]
    consume_quantity: int = 0

    @classmethod
    def from_dict(cls, raw: dict) -> "ItemActionGrant":
        return cls(
            action_id=raw["action_id"],
            availability=raw["availability"],
            consume_quantity=raw.get("consume_quantity", 0),
        )


@dataclass
class Item:
    id: str
    name: str
    interaction_type: Literal["equippable", "consumable", "inventory_only"]
    category: str
    rank: str
    description: str
    world_anvil_url: str
    gm_notes: str
    gm_special_properties: str
    price: str
    weight: float  # pounds
    augmentation_templates: List[Augmentation]
    player_visible: bool = True
    approval_status: Literal["approved", "pending"] = "approved"
    submitted_by_instance_id: str | None = None
    submitted_by_name: str | None = None
    can_contain_items: bool = False
    contents_weight_behavior: Literal["normal", "ignored"] = "normal"
    attribute_profile: AttributeProfile | None = None
    action_grants: List[ItemActionGrant] = field(default_factory=list)
    attributes: dict[str, AttributeBridge] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if isinstance(self.weight, bool) or not isinstance(self.weight, int | float):
            raise ValueError("Item weight must be numeric.")
        self.weight = float(self.weight)
        if not isfinite(self.weight) or self.weight < 0:
            raise ValueError("Item weight must be finite and nonnegative.")
        if (
            not self.can_contain_items
            and self.contents_weight_behavior != "normal"
        ):
            raise ValueError(
                "Only storage containers can change contained-weight behavior."
            )

    @classmethod
    def from_dict(cls, raw: dict) -> "Item":
        raw_attributes = raw.get("attributes", raw.get("facts", {}))
        return cls(
            id=raw["id"],
            name=raw["name"],
            interaction_type=raw.get("interaction_type", "inventory_only"),
            category=raw.get("category", ""),
            rank=raw.get("rank", ""),
            description=raw["description"],
            world_anvil_url=raw.get("world_anvil_url", ""),
            gm_notes=raw.get("gm_notes", ""),
            gm_special_properties=raw.get("gm_special_properties", ""),
            price=raw["price"],
            weight=float(raw.get("weight", 0)),
            player_visible=bool(raw.get("player_visible", True)),
            approval_status=raw.get("approval_status", "approved"),
            submitted_by_instance_id=raw.get("submitted_by_instance_id"),
            submitted_by_name=raw.get("submitted_by_name"),
            can_contain_items=bool(raw.get("can_contain_items", False)),
            contents_weight_behavior=raw.get("contents_weight_behavior", "normal"),
            augmentation_templates=[
                Augmentation.from_dict(augmentation)
                for augmentation in raw.get("augmentation_templates", [])
            ],
            attribute_profile=raw.get("attribute_profile", raw.get("fact_profile")),
            action_grants=[
                ItemActionGrant.from_dict(grant)
                for grant in raw.get("action_grants", [])
            ],
            attributes={
                key: AttributeBridge.from_dict(bridge)
                for key, bridge in raw_attributes.items()
            },
        )
