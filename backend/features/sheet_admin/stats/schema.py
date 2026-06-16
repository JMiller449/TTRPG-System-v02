from __future__ import annotations

from typing import Literal

from pydantic import Field

from backend.core.transport import RequestModel
from backend.features.sheet_admin.formulas.schema import FormulaPayload

BaseStatName = Literal[
    "strength",
    "dexterity",
    "constitution",
    "perception",
    "arcane",
    "will",
]

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


class SetSheetBaseStat(RequestModel):
    sheet_id: str = Field(min_length=1)
    stat_name: BaseStatName
    value: int
    type: Literal["set_sheet_base_stat"]


class SetSheetFormulaStat(RequestModel):
    sheet_id: str = Field(min_length=1)
    stat_name: FormulaStatName
    formula: FormulaPayload
    type: Literal["set_sheet_formula_stat"]
