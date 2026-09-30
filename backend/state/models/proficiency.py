from dataclasses import dataclass, field
from typing import Literal

ProficiencyCategory = Literal["custom", "weapon_family"]


def _normalize_tag_ids(tag_ids: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for tag_id in tag_ids:
        if not isinstance(tag_id, str):
            raise ValueError("Tag IDs must be strings.")
        value = tag_id.strip()
        if not value:
            raise ValueError("Tag IDs cannot be blank.")
        if value not in seen:
            seen.add(value)
            normalized.append(value)
    return normalized


@dataclass
class ProficiencyBridge:
    relationship_id: str
    prof_id: str
    use_count: int
    growth_rate: float
    growth_points: float | None = None

    @property
    def progress(self) -> float:
        if self.growth_points is not None:
            return min(1.0, max(0.0, self.growth_points))
        return min(1.0, max(0.0, self.growth_rate * self.use_count))

    @classmethod
    def from_dict(cls, raw: dict) -> "ProficiencyBridge":
        return cls(
            relationship_id=raw["relationship_id"],
            prof_id=raw["prof_id"],
            use_count=raw["use_count"],
            growth_rate=raw["growth_rate"],
            growth_points=raw.get("growth_points"),
        )


@dataclass
class Proficiency:
    id: str
    name: str
    description: str
    category: ProficiencyCategory = "custom"
    default_growth_rate: float = 0.01
    tags: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        self.tags = _normalize_tag_ids(self.tags)

    @classmethod
    def from_dict(cls, raw: dict) -> "Proficiency":
        return cls(
            id=raw["id"],
            name=raw["name"],
            description=raw.get("description", ""),
            category=raw.get("category", "custom"),
            default_growth_rate=raw.get("default_growth_rate", 0.01),
            tags=list(raw.get("tags", [])),
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
            tags=[
                "weapon",
                *(
                    ["sword"]
                    if proficiency_id in {"long_swords", "short_swords"}
                    else ["dagger"] if proficiency_id == "knives" else []
                ),
            ],
        )
        for proficiency_id, description in descriptions.items()
    }
