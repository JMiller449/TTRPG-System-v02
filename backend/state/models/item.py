from dataclasses import dataclass
from typing import List

from backend.state.models.augmentation import Augmentation


@dataclass
class ItemBridge:
    relationship_id: str
    count: int
    active: bool
    item_id: str

    @classmethod
    def from_dict(cls, raw: dict) -> "ItemBridge":
        return cls(
            relationship_id=raw["relationship_id"],
            count=raw["count"],
            active=raw["active"],
            item_id=raw["item_id"],
        )


@dataclass
class Item:
    id: str
    name: str
    description: str
    world_anvil_url: str
    gm_notes: str
    gm_special_properties: str
    price: str
    weight: str
    augmentation_templates: List[Augmentation]

    @classmethod
    def from_dict(cls, raw: dict) -> "Item":
        return cls(
            id=raw["id"],
            name=raw["name"],
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
        )
