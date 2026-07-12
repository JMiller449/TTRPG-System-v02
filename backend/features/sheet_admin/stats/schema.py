from __future__ import annotations

from math import isfinite
from typing import Literal

from pydantic import Field, model_validator

from backend.core.transport import RequestModel
from backend.features.sheet_admin.formulas.schema import FormulaPayload
from backend.features.sheet_admin.sheets.schema import ResistancesPayload

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


class SetInstancedSheetBaseStat(RequestModel):
    instance_id: str = Field(min_length=1)
    stat_name: BaseStatName
    value: int
    type: Literal["set_instanced_sheet_base_stat"]


class SetInstancedSheetUnassignedStatPoints(RequestModel):
    instance_id: str = Field(min_length=1)
    value: int = Field(ge=0)
    type: Literal["set_instanced_sheet_unassigned_stat_points"]


class AllocateInstancedSheetStatPoints(RequestModel):
    instance_id: str = Field(min_length=1)
    allocations: dict[BaseStatName | FormulaStatName, int]
    type: Literal["allocate_instanced_sheet_stat_points"]

    @model_validator(mode="after")
    def validate_allocations(self) -> "AllocateInstancedSheetStatPoints":
        total = 0
        for stat_name, value in self.allocations.items():
            if value < 0:
                raise ValueError(
                    f"Allocation for '{stat_name}' must not be negative."
                )
            total += value
        if total <= 0:
            raise ValueError("Allocate at least one stat point.")
        return self


class SetSheetFormulaStat(RequestModel):
    sheet_id: str = Field(min_length=1)
    stat_name: FormulaStatName
    formula: FormulaPayload
    type: Literal["set_sheet_formula_stat"]


class SetInstancedSheetFormulaStat(RequestModel):
    instance_id: str = Field(min_length=1)
    stat_name: FormulaStatName
    formula: FormulaPayload
    type: Literal["set_instanced_sheet_formula_stat"]


class SetSheetResistances(RequestModel):
    sheet_id: str = Field(min_length=1)
    resistances: ResistancesPayload
    type: Literal["set_sheet_resistances"]

    @model_validator(mode="after")
    def validate_resistance_range(self) -> "SetSheetResistances":
        for name, value in self.resistances.model_dump(mode="python").items():
            if not isfinite(value) or value < 0 or value > 1:
                raise ValueError(
                    f"Resistance '{name}' must be a finite fraction from 0 to 1."
                )
        return self


class SetInstancedSheetResistances(RequestModel):
    instance_id: str = Field(min_length=1)
    resistances: ResistancesPayload
    type: Literal["set_instanced_sheet_resistances"]

    @model_validator(mode="after")
    def validate_resistance_range(self) -> "SetInstancedSheetResistances":
        for name, value in self.resistances.model_dump(mode="python").items():
            if not isfinite(value) or value < 0 or value > 1:
                raise ValueError(
                    f"Resistance '{name}' must be a finite fraction from 0 to 1."
                )
        return self
