from dataclasses import dataclass
from typing import Literal


ProficiencyCategory = Literal["custom", "weapon_family"]


@dataclass
class ProficiencyBridge:
    relationship_id: str
    prof_id: str
    use_count: int
    growth_rate: float

    @classmethod
    def from_dict(cls, raw: dict) -> "ProficiencyBridge":
        return cls(
            relationship_id=raw["relationship_id"],
            prof_id=raw["prof_id"],
            use_count=raw["use_count"],
            growth_rate=raw["growth_rate"],
        )


@dataclass
class Proficiency:
    id: str
    name: str
    description: str
    category: ProficiencyCategory = "custom"
    default_growth_rate: float = 0.01

    @classmethod
    def from_dict(cls, raw: dict) -> "Proficiency":
        return cls(
            id=raw["id"],
            name=raw["name"],
            description=raw.get("description", ""),
            category=raw.get("category", "custom"),
            default_growth_rate=raw.get("default_growth_rate", 0.01),
        )


def seeded_weapon_family_proficiencies() -> dict[str, Proficiency]:
    descriptions = {
        "long_swords": "Weapon-family proficiency for long sword use.",
        "short_swords": "Weapon-family proficiency for short sword use.",
        "spears": "Weapon-family proficiency for spear use.",
        "shields": "Weapon-family proficiency for shield use.",
        "pugilists": "Weapon-family proficiency for unarmed and pugilist use.",
        "staffs": "Weapon-family proficiency for staff use.",
        "bows": "Weapon-family proficiency for bow use.",
        "throwing": "Weapon-family proficiency for thrown weapon use.",
        "knives": "Weapon-family proficiency for knife use.",
        "axes": "Weapon-family proficiency for axe use.",
    }
    names = {
        "long_swords": "Long Swords",
        "short_swords": "Short Swords",
        "spears": "Spears",
        "shields": "Shields",
        "pugilists": "Pugilists",
        "staffs": "Staffs",
        "bows": "Bows",
        "throwing": "Throwing",
        "knives": "Knives",
        "axes": "Axes",
    }
    return {
        proficiency_id: Proficiency(
            id=proficiency_id,
            name=names[proficiency_id],
            description=description,
            category="weapon_family",
        )
        for proficiency_id, description in descriptions.items()
    }
