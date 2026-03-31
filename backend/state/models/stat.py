from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from backend.state.models.formula import Formula

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
