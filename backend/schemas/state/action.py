from dataclasses import dataclass
from typing import List, Literal

from backend.schemas.state.damage import DamageTotal
from backend.schemas.state.formula import Formula
from backend.schemas.state.tag import Tag

ACTION_COST_TYPE = Literal["Health", "Mana", "ActionPoint"]
ACTION_RANK = Literal[
    "F",
    "F+",
    "E",
    "E+",
    "D",
    "D+",
    "C",
    "C+",
    "B",
    "B+",
    "A",
    "A+",
    "S",
    "S+",
    "SS",
    "SS+",
]


@dataclass
class Cost:
    types: ACTION_COST_TYPE
    amount: int


@dataclass
class Action:
    id: str
    name: str
    rank: ACTION_RANK
    hit_mod: Formula
    damage: DamageTotal
    healing: Formula
    range: Formula
    notes: str
    costs: List[Cost]
    tags: List[Tag]
