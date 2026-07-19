from copy import deepcopy
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from math import isfinite
from typing import Dict

from backend.state.models.attribute import AttributeBridge
from backend.state.models.item import ItemBridge
from backend.state.models.proficiency import ProficiencyBridge
from backend.state.models.resistance import Resistances
from backend.state.models.shared import Bridge
from backend.state.models.formula import Formula
from backend.state.models.stat import (
    FormulaStatName,
    Stats,
    default_max_health_formula,
    default_max_mana_formula,
)


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
    racial_hp_multiplier: float = 1.0
    max_health: Formula = field(default_factory=default_max_health_formula)
    max_mana: Formula = field(default_factory=default_max_mana_formula)
    stat_bonuses: Dict[FormulaStatName, int] = field(default_factory=dict)

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
            racial_hp_multiplier=raw.get("racial_hp_multiplier", 1.0),
            max_health=(
                Formula.from_dict(raw["max_health"])
                if raw.get("max_health") is not None
                else Formula.from_dict(raw["stats"]["health"])
            ),
            max_mana=(
                Formula.from_dict(raw["max_mana"])
                if raw.get("max_mana") is not None
                else Formula.from_dict(raw["stats"]["mana"])
            ),
            stat_bonuses={
                key: int(value)
                for key, value in raw.get("stat_bonuses", {}).items()
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
    racial_hp_multiplier: float = 1.0
    max_health: Formula = field(default_factory=default_max_health_formula)
    max_mana: Formula = field(default_factory=default_max_mana_formula)
    stat_bonuses: Dict[FormulaStatName, int] = field(default_factory=dict)
    # Reactions use two decimal places so half reactions and other authored
    # fractional limits survive checkpoint round trips without binary drift.
    reactions: float = 0.0
    contribution_points: int = 0
    pinned_action_ids: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        try:
            normalized_reactions = Decimal(str(self.reactions)).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
        except (InvalidOperation, ValueError) as exc:
            raise ValueError("Reactions must be a finite number.") from exc
        if not isfinite(float(normalized_reactions)) or normalized_reactions < 0:
            raise ValueError("Reactions must be finite and nonnegative.")
        if isinstance(self.contribution_points, bool) or not isinstance(
            self.contribution_points, int
        ) or self.contribution_points < 0:
            raise ValueError("Contribution points must be a nonnegative whole number.")
        if (
            any(not isinstance(action_id, str) or not action_id for action_id in self.pinned_action_ids)
            or len(self.pinned_action_ids) != len(set(self.pinned_action_ids))
        ):
            raise ValueError("Pinned action IDs must be unique nonempty strings.")
        self.reactions = float(normalized_reactions)

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
            racial_hp_multiplier=raw.get(
                "racial_hp_multiplier",
                template.racial_hp_multiplier if template is not None else 1.0,
            ),
            max_health=(
                Formula.from_dict(raw["max_health"])
                if raw.get("max_health") is not None
                else deepcopy(template.max_health)
                if template is not None
                else default_max_health_formula()
            ),
            max_mana=(
                Formula.from_dict(raw["max_mana"])
                if raw.get("max_mana") is not None
                else deepcopy(template.max_mana)
                if template is not None
                else default_max_mana_formula()
            ),
            stat_bonuses={
                key: int(value)
                for key, value in raw.get(
                    "stat_bonuses",
                    template.stat_bonuses if template is not None else {},
                ).items()
            },
            reactions=float(raw.get("reactions", 0)),
            contribution_points=int(raw.get("contribution_points", 0)),
            pinned_action_ids=list(raw.get("pinned_action_ids", [])),
        )
