from dataclasses import dataclass
from typing import Literal

from backend.schemas.state.formula import Formula

StatName = Literal[
    # base stats
    "strength"
    "dexterity"
    "constitution"
    "perception"
    "arcane"
    "will"
    # sub stats
    "lifting"
    "carry_weight"
    "acrobatics"
    "stamina"
    "reaction_time"
    "health"
    "endurance"
    "pain_tolerance"
    "sight_distance"
    "intuition"
    "registration"
    "mana"
    "control"
    "sensitivity"
    "charisma"
    "mental_fortitude"
    "courage"
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
