from dataclasses import dataclass
from enum import Enum
from typing import List, Literal

from backend.schemas.state.formula import Formula

DamageType = Literal[
    "Arcane",
    "Slashing",
    "Bludgeoning",
    "Piercing",
    "Fire",
    "Water",
    "Earth",
    "Wind",
    "Light",
    "Dark",
    "Lightning",
    "Ice",
    "Time",
    "Gravity",
    "Psychic",
]


@dataclass
class Damage:
    damage: Formula
    damage_type: DamageType


@dataclass
class DamageTotal:
    damages: List[Damage]
