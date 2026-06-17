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


class ResistancesPayload(ProtocolModel):
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


class SheetPayload(ProtocolModel):
    id: str
    name: str
    notes: str = ""
    dm_only: bool
    xp_given_when_slayed: int
    xp_cap: str
    proficiencies: dict[str, ProficiencyBridgePayload]
    items: dict[str, ItemBridgePayload]
    stats: StatsPayload
    resistances: ResistancesPayload = Field(default_factory=ResistancesPayload)
    slayed_record: dict[str, SheetSlayedBridgePayload]
    actions: dict[str, BridgePayload]


class InstancedSheetPayload(ProtocolModel):
    parent_id: str
    notes: str = ""
    health: float
    mana: int
    resistances: ResistancesPayload = Field(default_factory=ResistancesPayload)
    augments: dict[str, BridgePayload]


class FormulaDefinitionPayload(ProtocolModel):
    id: str
    formula: FormulaPayload


DamageTypePayload = Literal[
    "Arcane",
    "Slashing",
    "Bludgeoning",
    "Piercing",
    "Fire",
    "Water",
    "Earth",
    "Wind",
    "Light",
    "Dark",
    "Lightning",
    "Ice",
    "Time",
    "Gravity",
    "Psychic",
]


class SendMessageStepPayload(ProtocolModel):
    step_id: str
    message: FormulaPayload
    type: Literal["send_message"]


class NumericBoundsPayload(ProtocolModel):
    min_value: FormulaPayload | None = None
    max_value: FormulaPayload | None = None
    on_min_violation: Literal["clamp", "reject"] = "clamp"
    on_max_violation: Literal["clamp", "reject"] = "clamp"


class SetValueStepPayload(NumericBoundsPayload):
    step_id: str
    path: list[str]
    value: FormulaPayload
    target: Literal["caster", "target"] = "caster"
    type: Literal["set_value"]


class IncrementValueStepPayload(NumericBoundsPayload):
    step_id: str
    path: list[str]
    amount: FormulaPayload
    target: Literal["caster", "target"] = "caster"
    type: Literal["increment_value"]


class DecrementValueStepPayload(NumericBoundsPayload):
    step_id: str
    path: list[str]
    amount: FormulaPayload
    target: Literal["caster", "target"] = "caster"
    type: Literal["decrement_value"]


class ResolveDamageStepPayload(ProtocolModel):
    step_id: str
    damage_type: DamageTypePayload
    amount: FormulaPayload
    target: Literal["caster", "target"] = "caster"
    type: Literal["resolve_damage"]


class GainProficiencyUseStepPayload(ProtocolModel):
    step_id: str
    proficiency_id: str
    amount: FormulaPayload
    target: Literal["caster", "target"] = "caster"
    type: Literal["gain_proficiency_use"]


class ApplyAugmentationStepPayload(ProtocolModel):
    step_id: str
    augmentation_id: str
    operation: Literal["apply", "remove"] = "apply"
    target: Literal["caster", "target"] = "caster"
    type: Literal["apply_augmentation"]


class ApplyConditionPresetStepPayload(ProtocolModel):
    step_id: str
    condition_id: str
    operation: Literal["apply", "remove"] = "apply"
    target: Literal["caster", "target"] = "caster"
    type: Literal["apply_condition_preset"]


ActionStepPayload = Annotated[
    SendMessageStepPayload
    | SetValueStepPayload
    | IncrementValueStepPayload
    | DecrementValueStepPayload
    | ResolveDamageStepPayload
    | GainProficiencyUseStepPayload
    | ApplyAugmentationStepPayload
    | ApplyConditionPresetStepPayload,
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


class ProficiencyPayload(ProtocolModel):
    id: str
    name: str
    description: str


class AugmentationSourcePayload(ProtocolModel):
    type: Literal[
        "item",
        "action",
        "spell",
        "condition",
        "ally_effect",
        "manual",
        "other",
    ]
    id: str | None = None
    label: str | None = None


class AugmentationTargetPayload(ProtocolModel):
    root: Literal["state", "sheet", "instance"]
    path: list[str]


class FormulaModifierEffectPayload(ProtocolModel):
    operation: Literal["add", "subtract", "multiply", "divide", "set"]
    value: FormulaPayload
    type: Literal["formula_modifier"] = "formula_modifier"


AugmentationEffectPayload = Annotated[
    FormulaModifierEffectPayload,
    Field(discriminator="type"),
]


class AugmentationLifecyclePayload(ProtocolModel):
    duration: str | None = None
    expires_at: str | None = None
    removal_condition: str | None = None


class AugmentationPayload(ProtocolModel):
    id: str
    name: str
    description: str = ""
    source: AugmentationSourcePayload
    scope: Literal["sheet", "instance"]
    target: AugmentationTargetPayload
    effect: AugmentationEffectPayload
    active: bool = True
    applied: bool = False
    applied_target_id: str | None = None
    lifecycle: AugmentationLifecyclePayload = Field(
        default_factory=AugmentationLifecyclePayload
    )


class ItemPayload(ProtocolModel):
    id: str
    name: str
    description: str
    world_anvil_url: str = ""
    gm_notes: str = ""
    gm_special_properties: str = ""
    price: str
    weight: str
    stat_augmentations: list[StatAugmentationPayload]
    augmentation_templates: list[AugmentationPayload] = Field(default_factory=list)


class ConditionPresetPayload(ProtocolModel):
    id: str
    name: str
    description: str = ""
    visibility: Literal["public", "gm_only"] = "public"
    augmentation_ids: list[str] = Field(default_factory=list)
    augmentation_templates: list[AugmentationPayload] = Field(default_factory=list)


class BackendStateSnapshotPayload(ProtocolModel):
    sheets: dict[str, SheetPayload] = Field(default_factory=dict)
    instanced_sheets: dict[str, InstancedSheetPayload] = Field(default_factory=dict)
    formulas: dict[str, FormulaDefinitionPayload] = Field(default_factory=dict)
    actions: dict[str, ActionPayload] = Field(default_factory=dict)
    items: dict[str, ItemPayload] = Field(default_factory=dict)
    proficiencies: dict[str, ProficiencyPayload] = Field(default_factory=dict)
    augmentations: dict[str, AugmentationPayload] = Field(default_factory=dict)
    condition_presets: dict[str, ConditionPresetPayload] = Field(default_factory=dict)
