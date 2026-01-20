from dataclasses import dataclass
from typing import Dict

from backend.schemas.state.shared import Bridge


@dataclass
class Action:
    id: str
    name: str
    rank: str
    hit_mod: str
    damage: str
    per_turn_count: str
    range: str
    damage_type: str
    notes: str
    trion: str
    proficiencies: Dict[str, Bridge]
