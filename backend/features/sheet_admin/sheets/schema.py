from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from backend.core.transport import RequestModel
from backend.features.sheet_admin.formulas.schema import FormulaPayload


class ActionBridgePayload(BaseModel):
    relationship_id: str = Field(min_length=1)
    entry_id: str = Field(min_length=1)


class SheetActionBridgePayload(BaseModel):
    relationship_id: str = Field(min_length=1)
    action_id: str = Field(min_length=1)


class ItemBridgePayload(BaseModel):
    relationship_id: str = Field(min_length=1)
    count: int = Field(ge=0)
    active: bool
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


class SheetDefinitionPayload(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    dm_only: bool = False
    xp_given_when_slayed: int = Field(ge=0)
    xp_cap: str = ""
    proficiencies: dict[str, ProficiencyBridgePayload] = Field(default_factory=dict)
    items: dict[str, ItemBridgePayload] = Field(default_factory=dict)
    stats: StatsPayload
    slayed_record: dict[str, SheetSlayedBridgePayload] = Field(default_factory=dict)
    actions: dict[str, ActionBridgePayload] = Field(default_factory=dict)


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
