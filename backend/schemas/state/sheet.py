from dataclasses import dataclass
from typing import Dict

from backend.schemas.state.item import ItemBridge
from backend.schemas.state.proficiency import ProficiencyBridge
from backend.schemas.state.shared import Bridge
from backend.schemas.state.stat import Stats


@dataclass
class SheetSlayedBridge:
    sheet_id: str
    count: int


# Static sheet, contains basic data like max health, base statistics, max actions, etc.
@dataclass
class Sheet:
    id: str
    name: str
    dm_only: bool  # toogle to hide from other users
    xp_given_when_slayed: int
    xp_cap: str
    proficiencies: Dict[str, ProficiencyBridge]
    items: Dict[str, ItemBridge]
    stats: Stats
    slayed_record: Dict[str, SheetSlayedBridge]
    actions: Dict[str, Bridge]


# an instanced persistant sheet, contains current values and augmented stat values (i.e. current health/mana)
@dataclass
class InstancedSheet:
    parent_id: str  # points to parent Sheet
    health: float
    mana: int
    augments: Dict[str, Bridge]  # TODO add augments dict
