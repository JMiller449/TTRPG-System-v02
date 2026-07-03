from dataclasses import dataclass, field
from typing import Dict

from backend.state.models.fact import FactBridge
from backend.state.models.item import ItemBridge
from backend.state.models.proficiency import ProficiencyBridge
from backend.state.models.resistance import Resistances
from backend.state.models.shared import Bridge
from backend.state.models.stat import Stats


@dataclass
class SheetSlayedBridge:
    sheet_id: str
    count: int

    @classmethod
    def from_dict(cls, raw: dict) -> "SheetSlayedBridge":
        return cls(
            sheet_id=raw["sheet_id"],
            count=raw["count"],
        )


# Static sheet, contains basic data like max health, base statistics, max actions, etc.
@dataclass
class Sheet:
    id: str
    name: str
    notes: str
    dm_only: bool  # toogle to hide from other users
    xp_given_when_slayed: int
    xp_cap: str
    proficiencies: Dict[str, ProficiencyBridge]
    items: Dict[str, ItemBridge]
    stats: Stats
    resistances: Resistances
    slayed_record: Dict[str, SheetSlayedBridge]
    actions: Dict[str, Bridge]
    facts: Dict[str, FactBridge] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, raw: dict) -> "Sheet":
        return cls(
            id=raw["id"],
            name=raw["name"],
            notes=raw.get("notes", ""),
            dm_only=raw["dm_only"],
            xp_given_when_slayed=raw["xp_given_when_slayed"],
            xp_cap=raw["xp_cap"],
            proficiencies={
                key: ProficiencyBridge.from_dict(bridge)
                for key, bridge in raw.get("proficiencies", {}).items()
            },
            items={
                key: ItemBridge.from_dict(bridge)
                for key, bridge in raw.get("items", {}).items()
            },
            stats=Stats.from_dict(raw["stats"]),
            resistances=Resistances.from_dict(raw.get("resistances")),
            slayed_record={
                key: SheetSlayedBridge.from_dict(bridge)
                for key, bridge in raw.get("slayed_record", {}).items()
            },
            actions={
                key: Bridge.from_dict(bridge)
                for key, bridge in raw.get("actions", {}).items()
            },
            facts={
                key: FactBridge.from_dict(bridge)
                for key, bridge in raw.get("facts", {}).items()
            },
        )


# an instanced persistant sheet, contains current values and augmented stat values
# (i.e. current health/mana)
@dataclass
class InstancedSheet:
    parent_id: str  # points to parent Sheet
    notes: str
    health: float
    mana: int
    resistances: Resistances
    augments: Dict[str, Bridge]  # TODO add augments dict

    @classmethod
    def from_dict(cls, raw: dict) -> "InstancedSheet":
        return cls(
            parent_id=raw["parent_id"],
            notes=raw.get("notes", ""),
            health=raw["health"],
            mana=raw["mana"],
            resistances=Resistances.from_dict(raw.get("resistances")),
            augments={
                key: Bridge.from_dict(bridge)
                for key, bridge in raw.get("augments", {}).items()
            },
        )
