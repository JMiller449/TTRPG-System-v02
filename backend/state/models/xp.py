from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any


XP_QUANTUM = Decimal("0.01")


def normalize_xp(value: int | float | str | Decimal) -> float:
    try:
        decimal_value = Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError("XP values must be numeric.") from exc
    if not decimal_value.is_finite():
        raise ValueError("XP values must be finite.")
    return float(decimal_value.quantize(XP_QUANTUM, rounding=ROUND_HALF_UP))


@dataclass
class Party:
    id: str
    name: str
    member_instance_ids: list[str] = field(default_factory=list)

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "Party":
        return cls(
            id=raw["id"],
            name=raw["name"],
            member_instance_ids=list(raw.get("member_instance_ids", [])),
        )


@dataclass(frozen=True)
class KillParticipant:
    instance_id: str
    name: str

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "KillParticipant":
        return cls(instance_id=raw["instance_id"], name=raw["name"])


@dataclass
class KillRecord:
    id: str
    monster_name: str
    base_xp: float
    participants: list[KillParticipant]
    participant_count: int
    xp_percentage: float
    xp_per_participant: float
    occurred_at: str
    monster_sheet_id: str | None = None
    notes: str = ""

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "KillRecord":
        participants = [
            KillParticipant.from_dict(participant)
            for participant in raw.get("participants", [])
        ]
        if not participants:
            raise ValueError("A persisted kill must have at least one participant.")
        base_xp = normalize_xp(raw["base_xp"])
        participant_count = len(participants)
        return cls(
            id=raw["id"],
            monster_name=raw["monster_name"],
            base_xp=base_xp,
            participants=participants,
            participant_count=participant_count,
            xp_percentage=normalize_xp(100 / participant_count),
            xp_per_participant=normalize_xp(base_xp / participant_count),
            occurred_at=raw["occurred_at"],
            monster_sheet_id=raw.get("monster_sheet_id"),
            notes=raw.get("notes", ""),
        )


@dataclass
class XpAdjustment:
    id: str
    instance_id: str
    instance_name: str
    amount: float
    reason: str
    occurred_at: str

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "XpAdjustment":
        return cls(
            id=raw["id"],
            instance_id=raw["instance_id"],
            instance_name=raw["instance_name"],
            amount=normalize_xp(raw["amount"]),
            reason=raw.get("reason", ""),
            occurred_at=raw["occurred_at"],
        )
