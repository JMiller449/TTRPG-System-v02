from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class ProtocolModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class BridgePayload(ProtocolModel):
    relationship_id: str
    entry_id: str


class FormulaAliasPayload(ProtocolModel):
    name: str
    path: list[str]


class FormulaPayload(ProtocolModel):
    aliases: list[FormulaAliasPayload] | None
    text: str


class ProficiencyBridgePayload(ProtocolModel):
    relationship_id: str
    prof_id: str
    use_count: int
    growth_rate: float


class ItemBridgePayload(ProtocolModel):
    relationship_id: str
    count: int
    active: bool
    item_id: str


class SheetSlayedBridgePayload(ProtocolModel):
    sheet_id: str
    count: int


class StatsPayload(ProtocolModel):
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


class SheetPayload(ProtocolModel):
    id: str
    name: str
    dm_only: bool
    xp_given_when_slayed: int
    xp_cap: str
    proficiencies: dict[str, ProficiencyBridgePayload]
    items: dict[str, ItemBridgePayload]
    stats: StatsPayload
    slayed_record: dict[str, SheetSlayedBridgePayload]
    actions: dict[str, BridgePayload]


class InstancedSheetPayload(ProtocolModel):
    parent_id: str
    health: float
    mana: int
    augments: dict[str, BridgePayload]


class FormulaDefinitionPayload(ProtocolModel):
    id: str
    formula: FormulaPayload


class SendMessageStepPayload(ProtocolModel):
    step_id: str
    message: FormulaPayload
    type: Literal["send_message"]


class SetValueStepPayload(ProtocolModel):
    step_id: str
    path: list[str]
    value: FormulaPayload
    target: Literal["caster", "target"] = "caster"
    type: Literal["set_value"]


ActionStepPayload = Annotated[
    SendMessageStepPayload | SetValueStepPayload,
    Field(discriminator="type"),
]


class ActionPayload(ProtocolModel):
    id: str
    name: str
    notes: str = ""
    steps: list[ActionStepPayload] = Field(default_factory=list)


class StatAugmentationPayload(ProtocolModel):
    stat_name: str
    augmentation: FormulaPayload


class ItemPayload(ProtocolModel):
    id: str
    name: str
    description: str
    price: str
    weight: str
    stat_augmentations: list[StatAugmentationPayload]


class ProficiencyPayload(ProtocolModel):
    id: str
    name: str
    description: str


class BackendStateSnapshotPayload(ProtocolModel):
    sheets: dict[str, SheetPayload] = Field(default_factory=dict)
    instanced_sheets: dict[str, InstancedSheetPayload] = Field(default_factory=dict)
    formulas: dict[str, FormulaDefinitionPayload] = Field(default_factory=dict)
    actions: dict[str, ActionPayload] = Field(default_factory=dict)
    items: dict[str, ItemPayload] = Field(default_factory=dict)
    proficiencies: dict[str, ProficiencyPayload] = Field(default_factory=dict)
