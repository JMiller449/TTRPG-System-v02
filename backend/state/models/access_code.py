from __future__ import annotations

from dataclasses import dataclass


@dataclass
class SheetAccessCode:
    code: str
    sheet_id: str
    instance_id: str | None = None
    active: bool = True

    @classmethod
    def from_dict(cls, raw: dict) -> "SheetAccessCode":
        return cls(
            code=raw["code"],
            sheet_id=raw["sheet_id"],
            instance_id=raw.get("instance_id"),
            active=raw.get("active", True),
        )
