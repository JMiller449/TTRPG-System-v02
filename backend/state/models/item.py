from dataclasses import dataclass, field
from typing import List, Literal

from backend.state.models.augmentation import Augmentation
from backend.state.models.attribute import AttributeBridge, AttributeProfile


@dataclass
class ItemBridge:
    relationship_id: str
    count: int
    equipped: bool
    item_id: str

    @classmethod
    def from_dict(cls, raw: dict) -> "ItemBridge":
        return cls(
            relationship_id=raw["relationship_id"],
            count=raw["count"],
            equipped=raw.get("equipped", raw.get("active", False)),
            item_id=raw["item_id"],
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
    weight: str
    augmentation_templates: List[Augmentation]
    attribute_profile: AttributeProfile | None = None
    action_grants: List[ItemActionGrant] = field(default_factory=list)
    attributes: dict[str, AttributeBridge] = field(default_factory=dict)

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
            weight=raw["weight"],
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
