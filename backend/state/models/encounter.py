from __future__ import annotations

from dataclasses import dataclass


@dataclass
class EncounterEntry:
    template_id: str
    count: int

    @classmethod
    def from_dict(cls, raw: dict) -> "EncounterEntry":
        return cls(
            template_id=raw["template_id"],
            count=raw["count"],
        )


@dataclass
class EncounterPreset:
    id: str
    name: str
    entries: list[EncounterEntry]
    updated_at: str

    @classmethod
    def from_dict(cls, raw: dict) -> "EncounterPreset":
        return cls(
            id=raw["id"],
            name=raw["name"],
            entries=[
                EncounterEntry.from_dict(entry)
                for entry in raw.get("entries", [])
            ],
            updated_at=raw.get("updated_at", ""),
        )
