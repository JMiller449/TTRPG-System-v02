from dataclasses import dataclass
from typing import List

from backend.state.models.formula import Formula
from backend.state.models.stat import StatName


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
class StatAugmentation:
    stat_name: StatName
    augmentation: Formula

    @classmethod
    def from_dict(cls, raw: dict) -> "StatAugmentation":
        return cls(
            stat_name=raw["stat_name"],
            augmentation=Formula.from_dict(raw["augmentation"]),
        )


@dataclass
class Item:
    id: str
    name: str
    description: str
    price: str
    weight: str
    stat_augmentations: List[StatAugmentation]

    @classmethod
    def from_dict(cls, raw: dict) -> "Item":
        return cls(
            id=raw["id"],
            name=raw["name"],
            description=raw["description"],
            price=raw["price"],
            weight=raw["weight"],
            stat_augmentations=[
                StatAugmentation.from_dict(augmentation)
                for augmentation in raw.get("stat_augmentations", [])
            ],
        )
