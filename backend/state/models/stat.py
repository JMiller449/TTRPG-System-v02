from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from backend.state.models.formula import Formula, FormulaAliases

FormulaStatName = Literal[
    "lifting",
    "carry_weight",
    "acrobatics",
    "stamina",
    "reaction_time",
    "health",
    "endurance",
    "pain_tolerance",
    "sight_distance",
    "intuition",
    "registration",
    "mana",
    "control",
    "sensitivity",
    "charisma",
    "mental_fortitude",
    "courage",
]


def _default_formula(text: str, *aliases: str) -> Formula:
    return Formula(
        text=text,
        aliases=[
            FormulaAliases(name=alias, path=["stats", alias])
            for alias in aliases
        ],
    )


def default_sheet_formula_stats() -> dict[FormulaStatName, Formula]:
    return {
        "lifting": _default_formula("floor(@strength)", "strength"),
        "carry_weight": _default_formula("floor(@strength)", "strength"),
        "acrobatics": _default_formula(
            "floor((@dexterity + @registration) / 2)",
            "dexterity",
            "registration",
        ),
        "stamina": _default_formula("floor(@dexterity)", "dexterity"),
        "reaction_time": _default_formula(
            "floor((@dexterity + @intuition) / 2)",
            "dexterity",
            "intuition",
        ),
        "health": _default_formula("floor(@constitution)", "constitution"),
        "endurance": _default_formula(
            "floor((@health + @constitution) / 2)",
            "health",
            "constitution",
        ),
        "pain_tolerance": _default_formula(
            "floor((@endurance + @strength) / 2)",
            "endurance",
            "strength",
        ),
        "sight_distance": _default_formula("floor(@perception)", "perception"),
        "intuition": _default_formula("floor(@perception)", "perception"),
        "registration": _default_formula("floor(@perception)", "perception"),
        "mana": _default_formula("floor(@arcane)", "arcane"),
        "control": _default_formula(
            "floor((@arcane + @mana) / 2)",
            "arcane",
            "mana",
        ),
        "sensitivity": _default_formula(
            "floor((@intuition + @arcane) / 2)",
            "intuition",
            "arcane",
        ),
        "charisma": _default_formula("floor(@will)", "will"),
        "mental_fortitude": _default_formula(
            "floor((@will + @charisma) / 2)",
            "will",
            "charisma",
        ),
        "courage": _default_formula(
            "floor((@mental_fortitude + @charisma) / 2)",
            "mental_fortitude",
            "charisma",
        ),
    }


def default_max_health_formula() -> Formula:
    return Formula(
        text="floor(@health * @racial_hp_multiplier)",
        aliases=[
            FormulaAliases(name="health", path=["stats", "health"]),
            FormulaAliases(
                name="racial_hp_multiplier",
                path=["racial_hp_multiplier"],
            ),
        ],
    )


def default_max_mana_formula() -> Formula:
    return _default_formula(
        "floor(@arcane * @mana)",
        "arcane",
        "mana",
    )

StatName = Literal[
    # base stats
    "strength",
    "dexterity",
    "constitution",
    "perception",
    "arcane",
    "will",
    # sub stats
    "lifting",
    "carry_weight",
    "acrobatics",
    "stamina",
    "reaction_time",
    "health",
    "endurance",
    "pain_tolerance",
    "sight_distance",
    "intuition",
    "registration",
    "mana",
    "control",
    "sensitivity",
    "charisma",
    "mental_fortitude",
    "courage",
]


@dataclass
class Stats:
    # base stats
    strength: int
    dexterity: int
    constitution: int
    perception: int
    arcane: int
    will: int

    # sub stats
    lifting: Formula
    carry_weight: Formula
    acrobatics: Formula
    stamina: Formula
    reaction_time: Formula
    health: Formula
    endurance: Formula
    pain_tolerance: Formula
    sight_distance: Formula
    intuition: Formula
    registration: Formula
    mana: Formula
    control: Formula
    sensitivity: Formula
    charisma: Formula
    mental_fortitude: Formula
    courage: Formula

    @classmethod
    def from_dict(cls, raw: dict) -> "Stats":
        return cls(
            strength=raw["strength"],
            dexterity=raw["dexterity"],
            constitution=raw["constitution"],
            perception=raw["perception"],
            arcane=raw["arcane"],
            will=raw["will"],
            lifting=Formula.from_dict(raw["lifting"]),
            carry_weight=Formula.from_dict(raw["carry_weight"]),
            acrobatics=Formula.from_dict(raw["acrobatics"]),
            stamina=Formula.from_dict(raw["stamina"]),
            reaction_time=Formula.from_dict(raw["reaction_time"]),
            health=Formula.from_dict(raw["health"]),
            endurance=Formula.from_dict(raw["endurance"]),
            pain_tolerance=Formula.from_dict(raw["pain_tolerance"]),
            sight_distance=Formula.from_dict(raw["sight_distance"]),
            intuition=Formula.from_dict(raw["intuition"]),
            registration=Formula.from_dict(raw["registration"]),
            mana=Formula.from_dict(raw["mana"]),
            control=Formula.from_dict(raw["control"]),
            sensitivity=Formula.from_dict(raw["sensitivity"]),
            charisma=Formula.from_dict(raw["charisma"]),
            mental_fortitude=Formula.from_dict(raw["mental_fortitude"]),
            courage=Formula.from_dict(raw["courage"]),
        )
