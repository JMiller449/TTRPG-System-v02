from dataclasses import dataclass
from typing import Dict

from backend.state.models.item import ItemBridge
from backend.state.models.proficiency import ProficiencyBridge
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
    dm_only: bool  # toogle to hide from other users
    xp_given_when_slayed: int
    xp_cap: str
    proficiencies: Dict[str, ProficiencyBridge]
    items: Dict[str, ItemBridge]
    stats: Stats
    slayed_record: Dict[str, SheetSlayedBridge]
    actions: Dict[str, Bridge]

    @classmethod
    def from_dict(cls, raw: dict) -> "Sheet":
        return cls(
            id=raw["id"],
            name=raw["name"],
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
            slayed_record={
                key: SheetSlayedBridge.from_dict(bridge)
                for key, bridge in raw.get("slayed_record", {}).items()
            },
            actions={
                key: Bridge.from_dict(bridge)
                for key, bridge in raw.get("actions", {}).items()
            },
        )


# an instanced persistant sheet, contains current values and augmented stat values (i.e. current health/mana)
@dataclass
class InstancedSheet:
    parent_id: str  # points to parent Sheet
    health: float
    mana: int
    augments: Dict[str, Bridge]  # TODO add augments dict

    @classmethod
    def from_dict(cls, raw: dict) -> "InstancedSheet":
        return cls(
            parent_id=raw["parent_id"],
            health=raw["health"],
            mana=raw["mana"],
            augments={
                key: Bridge.from_dict(bridge)
                for key, bridge in raw.get("augments", {}).items()
            },
        )
