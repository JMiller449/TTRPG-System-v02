from dataclasses import dataclass
from typing import Dict

from backend.schemas.state.enemy import EnemyBridge
from backend.schemas.state.item import ItemBridge
from backend.schemas.state.shared import Bridge
from backend.schemas.state.proficiency import ProficiencyBridge


@dataclass
class Player:
    id: str
    name: str
    health: str
    ac: str
    xp_cap: str
    proficiencies: Dict[str, ProficiencyBridge]
    items: Dict[str, ItemBridge]
    stats: Dict[str, Bridge]
    enemy_slained: Dict[str, EnemyBridge]
    actions: Dict[str, Bridge]
