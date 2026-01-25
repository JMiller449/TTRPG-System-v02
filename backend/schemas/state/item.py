from dataclasses import dataclass
from typing import List

from backend.schemas.state.formula import Formula
from backend.schemas.state.stat import StatName


@dataclass
class ItemBridge:
    relationship_id: str
    count: int
    active: bool
    item_id: str


@dataclass
class StatAugmentation:
    stat_name: StatName
    augmentation: Formula


@dataclass
class Item:
    id: str
    name: str
    description: str
    price: str
    weight: str
    stat_augmentations: List[StatAugmentation]
