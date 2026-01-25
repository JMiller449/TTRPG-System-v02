from dataclasses import dataclass
from typing import Dict
from backend.schemas.state.item import ItemBridge
from backend.schemas.state.shared import Bridge
from backend.schemas.state.proficiency import Proficiency
from backend.schemas.state.stat import Stats


@dataclass
class SheetSlainedBridge:
    sheet_id: str
    count: int


@dataclass
class InstancedSheet:
    parent_id: str
    active: bool  # toggle for dm to hide goblins in the bush or character off screen
    health: float
    mana: int
    action_count: int


@dataclass
class Sheet:
    id: str
    name: str
    dm_only: bool  # toogle to hide from other users
    xp_given_when_slained: int
    xp_cap: str
    proficiencies: Dict[str, Proficiency]
    items: Dict[str, ItemBridge]
    stats: Stats
    slained_record: Dict[str, SheetSlainedBridge]
    actions: Dict[str, Bridge]
