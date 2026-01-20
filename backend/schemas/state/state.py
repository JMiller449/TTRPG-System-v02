from dataclasses import dataclass, field
from typing import Dict
from backend.schemas.state.enemy import Enemy
from backend.schemas.state.item import Item
from backend.schemas.state.player import Player
from backend.schemas.state.proficiency import Proficiency
from backend.schemas.state.stat import Stat
from backend.schemas.state.augmentation import Augmentation
from backend.schemas.state.action import Action


@dataclass
class State:
    players: Dict[str, Player] = field(default_factory=dict)
    actions: Dict[str, Action] = field(default_factory=dict)
    enemies: Dict[str, Enemy] = field(default_factory=dict)
    proficiencies: Dict[str, Proficiency] = field(default_factory=dict)
    items: Dict[str, Item] = field(default_factory=dict)
    stats: Dict[str, Stat] = field(default_factory=dict)
    augmentations: Dict[str, Augmentation] = field(default_factory=dict)
