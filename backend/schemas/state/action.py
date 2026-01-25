from dataclasses import dataclass

from backend.schemas.state.damage import DamageTotal
from backend.schemas.state.formula import Formula


@dataclass
class Action:
    id: str
    name: str
    action_point_cost: int
    rank: str
    hit_mod: Formula
    damage: DamageTotal
    healing: DamageTotal
    range: Formula
    notes: str
