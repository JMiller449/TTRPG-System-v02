from dataclasses import dataclass
from typing import List, Literal, cast

from backend.state.models.formula import Formula

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
DamageCategory = Literal["physical", "magical"]

DAMAGE_TYPES: tuple[DamageType, ...] = (
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
)
PHYSICAL_DAMAGE_TYPES: tuple[DamageType, ...] = (
    "Slashing",
    "Bludgeoning",
    "Piercing",
)


def ensure_damage_type(value: str) -> DamageType:
    if value not in DAMAGE_TYPES:
        raise ValueError(f"Damage type '{value}' is not supported.")
    return cast(DamageType, value)


def damage_type_category(damage_type: DamageType) -> DamageCategory:
    ensure_damage_type(damage_type)
    if damage_type in PHYSICAL_DAMAGE_TYPES:
        return "physical"
    return "magical"


def damage_type_resistance_key(damage_type: DamageType) -> str:
    ensure_damage_type(damage_type)
    return damage_type.lower()


@dataclass
class Damage:
    damage: Formula
    damage_type: DamageType


@dataclass
class DamageTotal:
    damages: List[Damage]
