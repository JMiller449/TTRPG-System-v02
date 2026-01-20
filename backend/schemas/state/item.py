from dataclasses import dataclass
from typing import Dict

from backend.schemas.state.augmentation import StatAugmentationBridge
from backend.schemas.state.shared import Bridge


@dataclass
class ItemBridge:
    relationship_id: str
    count: int
    active: bool
    item_id: str


@dataclass
class Item:
    id: str
    name: str
    description: str
    price: str
    weight: str
    stat_augmentations: Dict[str, StatAugmentationBridge]
