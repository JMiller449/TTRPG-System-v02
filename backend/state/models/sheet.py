from copy import deepcopy
from dataclasses import dataclass, field
from typing import Dict

from backend.state.models.attribute import AttributeBridge
from backend.state.models.item import ItemBridge
from backend.state.models.proficiency import ProficiencyBridge
from backend.state.models.resistance import Resistances
from backend.state.models.shared import Bridge
from backend.state.models.stat import Stats


def _numeric_xp(value: object) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


# Static sheet, contains basic data like max health, base statistics, max actions, etc.
@dataclass
class Sheet:
    id: str
    name: str
    notes: str
    dm_only: bool  # toogle to hide from other users
    xp_given_when_slayed: float
    xp_cap: float
    proficiencies: Dict[str, ProficiencyBridge]
    items: Dict[str, ItemBridge]
    stats: Stats
    resistances: Resistances
    actions: Dict[str, Bridge]
    attributes: Dict[str, AttributeBridge] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, raw: dict) -> "Sheet":
        raw_attributes = raw.get("attributes", raw.get("facts", {}))
        return cls(
            id=raw["id"],
            name=raw["name"],
            notes=raw.get("notes", ""),
            dm_only=raw["dm_only"],
            xp_given_when_slayed=_numeric_xp(raw.get("xp_given_when_slayed", 0)),
            xp_cap=_numeric_xp(raw.get("xp_cap", 0)),
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
            actions={
                key: Bridge.from_dict(bridge)
                for key, bridge in raw.get("actions", {}).items()
            },
            attributes={
                key: AttributeBridge.from_dict(bridge)
                for key, bridge in raw_attributes.items()
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
    stats: Stats | None = None
    items: Dict[str, ItemBridge] = field(default_factory=dict)
    proficiencies: Dict[str, ProficiencyBridge] = field(default_factory=dict)
    actions: Dict[str, Bridge] = field(default_factory=dict)
    attributes: Dict[str, AttributeBridge] = field(default_factory=dict)
    unassigned_stat_points: int = 0

    @classmethod
    def from_dict(
        cls,
        raw: dict,
        *,
        template: Sheet | None = None,
    ) -> "InstancedSheet":
        raw_stats = raw.get("stats")
        raw_items = raw.get("items")
        raw_proficiencies = raw.get("proficiencies")
        raw_actions = raw.get("actions")
        raw_attributes = raw.get("attributes")
        if raw_stats is None:
            stats = deepcopy(template.stats) if template is not None else None
        else:
            stats = Stats.from_dict(raw_stats)
        if raw_items is None:
            items = deepcopy(template.items) if template is not None else {}
        else:
            items = {
                key: ItemBridge.from_dict(bridge)
                for key, bridge in raw_items.items()
            }
        if raw_proficiencies is None:
            proficiencies = deepcopy(template.proficiencies) if template is not None else {}
        else:
            proficiencies = {
                key: ProficiencyBridge.from_dict(bridge)
                for key, bridge in raw_proficiencies.items()
            }
        if raw_actions is None:
            actions = deepcopy(template.actions) if template is not None else {}
        else:
            actions = {
                key: Bridge.from_dict(bridge)
                for key, bridge in raw_actions.items()
            }
        if raw_attributes is None:
            attributes = deepcopy(template.attributes) if template is not None else {}
        else:
            attributes = {
                key: AttributeBridge.from_dict(bridge)
                for key, bridge in raw_attributes.items()
            }
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
            stats=stats,
            items=items,
            proficiencies=proficiencies,
            actions=actions,
            attributes=attributes,
            unassigned_stat_points=raw.get("unassigned_stat_points", 0),
        )
