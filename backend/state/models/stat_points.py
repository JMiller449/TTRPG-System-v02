"""Durable point ledger; values describe base stats, never evaluated modifiers."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

PointSource = Literal["starting", "level_up", "manual", "legacy_unknown"]
POINT_SOURCES: tuple[PointSource, ...] = ("starting", "level_up", "manual", "legacy_unknown")
CORE_STATS = ("strength", "dexterity", "constitution", "perception", "arcane", "will")
LOCATIONS = ("unspent", *CORE_STATS)


@dataclass(frozen=True)
class StatPointEntry:
    id: str
    instance_id: str
    character_name: str
    occurred_at: str
    actor_role: str
    actor_instance_id: str | None
    request_id: str | None
    request_type: str
    kind: str
    skill: str | None
    amount: int
    previous_value: int
    resulting_value: int
    previous_unspent: int
    resulting_unspent: int
    changes: dict[str, dict[PointSource, int]]
    reason: str = ""
    sequence: int = 0
    player_allocation: bool = False

    def __post_init__(self) -> None:
        for value in (self.amount, self.previous_value, self.resulting_value,
                      self.previous_unspent, self.resulting_unspent, self.sequence):
            if isinstance(value, bool) or not isinstance(value, int):
                raise ValueError("Stat point audit values must be whole numbers.")
        if self.skill is not None and self.skill not in CORE_STATS:
            raise ValueError("Stat point audit contains an unsupported skill.")
        for location, parts in self.changes.items():
            if location not in LOCATIONS:
                raise ValueError("Stat point audit contains an unsupported location.")
            for source, amount in parts.items():
                if source not in POINT_SOURCES or isinstance(amount, bool) or not isinstance(amount, int):
                    raise ValueError("Stat point audit contains an invalid source or amount.")

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> StatPointEntry:
        return cls(**raw)


@dataclass
class StatPointSummary:
    earned: dict[PointSource, int] = field(default_factory=dict)
    removed: dict[PointSource, int] = field(default_factory=dict)
    unspent: int = 0
    allocated: dict[str, int] = field(default_factory=dict)
    allocation_sources: dict[str, dict[PointSource, int]] = field(default_factory=dict)
    unspent_sources: dict[PointSource, int] = field(default_factory=dict)
    player_allocations: dict[str, int] = field(default_factory=dict)
    reconciles: bool = False
    has_legacy_baseline: bool = False
