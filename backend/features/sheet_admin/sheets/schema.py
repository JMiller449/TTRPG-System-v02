from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, ValidationInfo, field_validator

from backend.core.transport import RequestModel
from backend.features.attributes.value_schema import AttributeBridgePayload
from backend.features.sheet_admin.formulas.schema import FormulaPayload
from backend.features.attributes.value_schema import AttributeBridgePayload


class ActionBridgePayload(BaseModel):
    relationship_id: str = Field(min_length=1)
    entry_id: str = Field(min_length=1)


class SheetActionBridgePayload(BaseModel):
    relationship_id: str = Field(min_length=1)
    action_id: str = Field(min_length=1)


class ItemBridgePayload(BaseModel):
    relationship_id: str = Field(min_length=1)
    count: int = Field(ge=0)
    equipped: bool
    item_id: str = Field(min_length=1)


class ProficiencyBridgePayload(BaseModel):
    relationship_id: str = Field(min_length=1)
    prof_id: str = Field(min_length=1)
    use_count: int = Field(ge=0)
    growth_rate: float


class SheetSlayedBridgePayload(BaseModel):
    sheet_id: str = Field(min_length=1)
    count: int = Field(ge=0)


class StatsPayload(BaseModel):
    strength: int
    dexterity: int
    constitution: int
    perception: int
    arcane: int
    will: int
    lifting: FormulaPayload
    carry_weight: FormulaPayload
    acrobatics: FormulaPayload
    stamina: FormulaPayload
    reaction_time: FormulaPayload
    health: FormulaPayload
    endurance: FormulaPayload
    pain_tolerance: FormulaPayload
    sight_distance: FormulaPayload
    intuition: FormulaPayload
    registration: FormulaPayload
    mana: FormulaPayload
    control: FormulaPayload
    sensitivity: FormulaPayload
    charisma: FormulaPayload
    mental_fortitude: FormulaPayload
    courage: FormulaPayload


class ResistancesPayload(BaseModel):
    resistance: float = 0.0
    physical: float = 0.0
    magical: float = 0.0
    slashing: float = 0.0
    bludgeoning: float = 0.0
    piercing: float = 0.0
    arcane: float = 0.0
    fire: float = 0.0
    water: float = 0.0
    earth: float = 0.0
    wind: float = 0.0
    light: float = 0.0
    dark: float = 0.0
    lightning: float = 0.0
    ice: float = 0.0
    time: float = 0.0
    gravity: float = 0.0
    psychic: float = 0.0


class SheetDefinitionPayload(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    notes: str = ""
    dm_only: bool = False
    xp_given_when_slayed: int = Field(ge=0)
    xp_cap: str = ""
    proficiencies: dict[str, ProficiencyBridgePayload] = Field(default_factory=dict)
    items: dict[str, ItemBridgePayload] = Field(default_factory=dict)
    stats: StatsPayload
    resistances: ResistancesPayload = Field(default_factory=ResistancesPayload)
    slayed_record: dict[str, SheetSlayedBridgePayload] = Field(default_factory=dict)
    actions: dict[str, ActionBridgePayload] = Field(default_factory=dict)
    attributes: dict[str, AttributeBridgePayload] = Field(default_factory=dict)


class CreateSheet(RequestModel):
    sheet: SheetDefinitionPayload
    type: Literal["create_sheet"]


class UpdateSheet(RequestModel):
    sheet_id: str = Field(min_length=1)
    sheet: SheetDefinitionPayload
    type: Literal["update_sheet"]


class DeleteSheet(RequestModel):
    sheet_id: str = Field(min_length=1)
    type: Literal["delete_sheet"]


class SetSheetNotes(RequestModel):
    sheet_id: str = Field(min_length=1)
    notes: str
    type: Literal["set_sheet_notes"]


class SetSheetSlayedCount(RequestModel):
    sheet_id: str = Field(min_length=1)
    slayed_sheet_id: str = Field(min_length=1)
    count: int = Field(ge=0)
    type: Literal["set_sheet_slayed_count"]


class CreateInstancedSheet(RequestModel):
    instance_id: str = Field(min_length=1)
    parent_sheet_id: str = Field(min_length=1)
    notes: str = ""
    health: float
    mana: int
    resistances: ResistancesPayload = Field(default_factory=ResistancesPayload)
    generate_access_code: bool = False
    type: Literal["create_instanced_sheet"]


class SetInstancedSheetNotes(RequestModel):
    instance_id: str = Field(min_length=1)
    notes: str
    type: Literal["set_instanced_sheet_notes"]


class SetInstancedSheetResource(RequestModel):
    instance_id: str = Field(min_length=1)
    resource: Literal["health", "mana"]
    value: float = Field(ge=0)
    type: Literal["set_instanced_sheet_resource"]

    @field_validator("value")
    @classmethod
    def validate_resource_value(cls, value: float, info: ValidationInfo) -> float:
        if info.data.get("resource") == "mana" and not float(value).is_integer():
            raise ValueError("Mana must be a whole number.")
        return value


class AdjustInstancedSheetResource(RequestModel):
    instance_id: str = Field(min_length=1)
    resource: Literal["health", "mana"]
    delta: float
    type: Literal["adjust_instanced_sheet_resource"]

    @field_validator("delta")
    @classmethod
    def validate_resource_delta(cls, value: float, info: ValidationInfo) -> float:
        if info.data.get("resource") == "mana" and not float(value).is_integer():
            raise ValueError("Mana adjustments must be whole numbers.")
        return value


class CreateSheetActionBridge(RequestModel):
    sheet_id: str = Field(min_length=1)
    bridge: SheetActionBridgePayload
    type: Literal["create_sheet_action_bridge"]


class UpdateSheetActionBridge(RequestModel):
    sheet_id: str = Field(min_length=1)
    relationship_id: str = Field(min_length=1)
    bridge: SheetActionBridgePayload
    type: Literal["update_sheet_action_bridge"]


class DeleteSheetActionBridge(RequestModel):
    sheet_id: str = Field(min_length=1)
    relationship_id: str = Field(min_length=1)
    type: Literal["delete_sheet_action_bridge"]


class CreateSheetItemBridge(RequestModel):
    sheet_id: str = Field(min_length=1)
    bridge: ItemBridgePayload
    type: Literal["create_sheet_item_bridge"]


class UpdateSheetItemBridge(RequestModel):
    sheet_id: str = Field(min_length=1)
    relationship_id: str = Field(min_length=1)
    bridge: ItemBridgePayload
    type: Literal["update_sheet_item_bridge"]


class DeleteSheetItemBridge(RequestModel):
    sheet_id: str = Field(min_length=1)
    relationship_id: str = Field(min_length=1)
    type: Literal["delete_sheet_item_bridge"]


class CreateSheetProficiencyBridge(RequestModel):
    sheet_id: str = Field(min_length=1)
    bridge: ProficiencyBridgePayload
    type: Literal["create_sheet_proficiency_bridge"]


class UpdateSheetProficiencyBridge(RequestModel):
    sheet_id: str = Field(min_length=1)
    relationship_id: str = Field(min_length=1)
    bridge: ProficiencyBridgePayload
    type: Literal["update_sheet_proficiency_bridge"]


class DeleteSheetProficiencyBridge(RequestModel):
    sheet_id: str = Field(min_length=1)
    relationship_id: str = Field(min_length=1)
    type: Literal["delete_sheet_proficiency_bridge"]
