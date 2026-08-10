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


def empty_damage_taken_by_type() -> dict[DamageType, int]:
    return {damage_type: 0 for damage_type in DAMAGE_TYPES}


def normalize_damage_taken_by_type(
    raw: dict[str, object] | None,
) -> dict[DamageType, int]:
    normalized = empty_damage_taken_by_type()
    if raw is None:
        return normalized

    unknown_types = set(raw).difference(DAMAGE_TYPES)
    if unknown_types:
        unknown = sorted(unknown_types)[0]
        raise ValueError(f"Damage tracker type '{unknown}' is not supported.")

    for raw_type, value in raw.items():
        damage_type = ensure_damage_type(raw_type)
        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            raise ValueError(
                f"Damage tracker value for '{damage_type}' must be a nonnegative whole number."
            )
        normalized[damage_type] = value
    return normalized


@dataclass
class Damage:
    damage: Formula
    damage_type: DamageType


@dataclass
class DamageTotal:
    damages: List[Damage]
