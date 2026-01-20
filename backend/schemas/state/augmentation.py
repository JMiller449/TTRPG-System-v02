from dataclasses import dataclass


@dataclass
class StatAugmentationBridge:
    relationship_id: str
    augmentation_id: str
    stat_id: str


@dataclass
class Augmentation:
    id: str
    augmentation: str
