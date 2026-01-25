from dataclasses import dataclass
from enum import Enum
from typing import List, Literal

from backend.schemas.state.formula import Formula

DamageType = Literal[
    "acid",
    "bludgeoning",
    "cold",
    "fire",
    "force",
    "lightning",
    "necrotic",
    "piercing",
    "poison",
    "psychic",
    "radiant",
    "slashing",
    "thunder",
]


@dataclass
class Damage:
    damage: Formula
    damage_type: DamageType


@dataclass
class DamageTotal:
    damages: List[Damage]
