from __future__ import annotations

from dataclasses import dataclass

from backend.state.models.damage import DAMAGE_TYPES


@dataclass
class TagDefinition:
    id: str
    name: str
    description: str = ""

    def __post_init__(self) -> None:
        self.id = self.id.strip()
        self.name = self.name.strip()
        self.description = self.description.strip()
        if not self.id:
            raise ValueError("Tag ID is required.")
        if not self.name:
            raise ValueError("Tag name is required.")

    @classmethod
    def from_dict(cls, raw: dict) -> "TagDefinition":
        return cls(
            id=raw["id"],
            name=raw["name"],
            description=raw.get("description", ""),
        )


def seeded_tag_definitions() -> dict[str, TagDefinition]:
    common = (
        "check",
        "hit",
        "attack",
        "damage",
        "healing",
        "dodge",
        "block",
        "parry",
        "contest",
        "stealth",
        "spell",
        "weapon",
        "sword",
        "dagger",
        "mana_regeneration",
        "physical",
        "magical",
        "resource",
        "mana",
        "cost",
        "health",
        "knowledge",
        "gate",
        "overload",
        "mana_manipulation",
        "movement",
        "shadow",
    )
    names = {
        tag_id: tag_id.replace("_", " ").title()
        for tag_id in (*common, *(damage_type.casefold() for damage_type in DAMAGE_TYPES))
    }
    return {
        tag_id: TagDefinition(id=tag_id, name=name)
        for tag_id, name in names.items()
    }


def validate_tag_ids(tag_ids: list[str], definitions: dict[str, TagDefinition]) -> None:
    missing = sorted({tag_id for tag_id in tag_ids if tag_id not in definitions})
    if missing:
        raise ValueError(f"Tags do not exist: {', '.join(missing)}.")


def normalize_tag_ids(tag_ids: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for tag_id in tag_ids:
        if not isinstance(tag_id, str):
            raise ValueError("Tag IDs must be strings.")
        value = tag_id.strip()
        if not value:
            raise ValueError("Tag IDs cannot be blank.")
        if value in seen:
            continue
        seen.add(value)
        normalized.append(value)
    return normalized


def collect_tag_references(value: object) -> set[str]:
    references: set[str] = set()

    def visit(current: object) -> None:
        if isinstance(current, dict):
            for key, child in current.items():
                if key in {"tags", "required_tags", "excluded_tags"} and isinstance(
                    child, list
                ):
                    references.update(
                        tag_id for tag_id in child if isinstance(tag_id, str)
                    )
                    continue
                visit(child)
            return
        if isinstance(current, (list, tuple)):
            for child in current:
                visit(child)

    visit(value)
    return references
