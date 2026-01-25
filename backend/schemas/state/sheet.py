from dataclasses import dataclass
from typing import Dict
from backend.schemas.state.item import ItemBridge
from backend.schemas.state.shared import Bridge
from backend.schemas.state.proficiency import Proficiency
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
    proficiencies: Dict[str, Proficiency]
    items: Dict[str, ItemBridge]
    stats: Stats
    slayed_record: Dict[str, SheetSlayedBridge]
    actions: Dict[str, Bridge]


# an instanced persistant sheet, contains current values and augmented stat values (i.e. current health/mana)
@dataclass
class PersistentSheet:
    parent_id: str # points to parent Sheet
    health: float
    mana: int
    augments: Dict[str, Bridge] # TODO add augments dict


# Holds combat specific information that does not need to be stored outside of combat or initiative
@dataclass
class CombatSheet:
    parent_id: str # points to parent PersistentSheet
    active: bool  # toggle for dm to hide goblins in the bush or character off screen
    action_count: int # remaining actions
    initiative: int # the initiative value rolled to determine initiative order
