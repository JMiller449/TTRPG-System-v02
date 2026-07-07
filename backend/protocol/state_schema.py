from __future__ import annotations

from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    ValidationInfo,
    field_validator,
    model_validator,
)

from backend.state.models.formula import normalize_formula_tags
from backend.features.attributes.value_schema import (
    AttributeBridgePayload,
    AttributeDefinitionPayload,
    AttributeValuePayload,
)


class ProtocolModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ActionHistoryEntryPayload(ProtocolModel):
    id: str
    request_id: str | None = None
    action_id: str
    action_name: str
    actor_role: Literal["player", "dm"]
    actor_sheet_id: str
    actor_instance_id: str | None = None
    target_sheet_id: str | None = None
    created_at: str
    state_version: int
    status: Literal["success", "failed"]
    summary: str
    emitted_messages: list[str] = Field(default_factory=list)
    mutation_summaries: list[str] = Field(default_factory=list)
    formula_summaries: list[str] = Field(default_factory=list)
    error: str | None = None
    redacted: bool = False


class BridgePayload(ProtocolModel):
    relationship_id: str
    entry_id: str


class FormulaAliasPayload(ProtocolModel):
    name: str
    path: list[str]


class FormulaPayload(ProtocolModel):
    aliases: list[FormulaAliasPayload] | None
    text: str
    tags: list[str] = Field(default_factory=list)


class ProficiencyBridgePayload(ProtocolModel):
    relationship_id: str
    prof_id: str
    use_count: int
    growth_rate: float


class ItemBridgePayload(ProtocolModel):
    relationship_id: str
    count: int
    equipped: bool
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
    evaluated_stats: dict[str, float | int] = Field(default_factory=dict)
    resistances: ResistancesPayload = Field(default_factory=ResistancesPayload)
    slayed_record: dict[str, SheetSlayedBridgePayload]
    actions: dict[str, BridgePayload]
    attributes: dict[str, AttributeBridgePayload] = Field(default_factory=dict)


class InstancedSheetPayload(ProtocolModel):
    parent_id: str
    notes: str = ""
    health: float
    mana: int
    stats: StatsPayload | None = None
    evaluated_stats: dict[str, float | int] = Field(default_factory=dict)
    items: dict[str, ItemBridgePayload] = Field(default_factory=dict)
    proficiencies: dict[str, ProficiencyBridgePayload] = Field(default_factory=dict)
    actions: dict[str, BridgePayload] = Field(default_factory=dict)
    attributes: dict[str, AttributeBridgePayload] = Field(default_factory=dict)
    resistances: ResistancesPayload = Field(default_factory=ResistancesPayload)
    augments: dict[str, BridgePayload]


class FormulaDefinitionPayload(ProtocolModel):
    id: str
    formula: FormulaPayload


class FormulaReferencePayload(ProtocolModel):
    formula_id: str
    type: Literal["formula_reference"]


FormulaValuePayload = FormulaPayload | FormulaReferencePayload


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
    message: FormulaValuePayload
    type: Literal["send_message"]


class CalculateValueStepPayload(ProtocolModel):
    step_id: str
    variable_id: str
    value: FormulaValuePayload
    type: Literal["calculate_value"]


class CalculatedValueReferencePayload(ProtocolModel):
    variable_id: str
    type: Literal["calculated_value"]


NumericValuePayload = FormulaValuePayload | CalculatedValueReferencePayload


class NumericBoundsPayload(ProtocolModel):
    min_value: NumericValuePayload | None = None
    max_value: NumericValuePayload | None = None
    on_min_violation: Literal["clamp", "reject"] = "clamp"
    on_max_violation: Literal["clamp", "reject"] = "clamp"


class SetValueStepPayload(NumericBoundsPayload):
    step_id: str
    path: list[str]
    value: NumericValuePayload
    target: Literal["caster", "target"] = "caster"
    type: Literal["set_value"]


class IncrementValueStepPayload(NumericBoundsPayload):
    step_id: str
    path: list[str]
    amount: NumericValuePayload
    target: Literal["caster", "target"] = "caster"
    type: Literal["increment_value"]


class DecrementValueStepPayload(NumericBoundsPayload):
    step_id: str
    path: list[str]
    amount: NumericValuePayload
    target: Literal["caster", "target"] = "caster"
    type: Literal["decrement_value"]


class ResolveDamageStepPayload(ProtocolModel):
    step_id: str
    damage_type: DamageTypePayload
    amount: NumericValuePayload
    target: Literal["caster", "target"] = "caster"
    type: Literal["resolve_damage"]


class GainProficiencyUseStepPayload(ProtocolModel):
    step_id: str
    proficiency_id: str
    amount: NumericValuePayload
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
    | CalculateValueStepPayload
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
    roll_mode_kind: Literal["none", "check", "damage"] = "none"
    notes: str = ""
    steps: list[ActionStepPayload] = Field(default_factory=list)
    attributes: dict[str, AttributeBridgePayload] = Field(default_factory=dict)


class ProficiencyPayload(ProtocolModel):
    id: str
    name: str
    description: str
    category: Literal["custom", "weapon_family"] = "custom"


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
    relationship_id: str | None = None
    application_id: str | None = None


class AugmentationTargetPayload(ProtocolModel):
    root: Literal["state", "sheet", "instance"]
    path: list[str]


class FormulaModifierSelectorPayload(ProtocolModel):
    required_tags: list[str] = Field(default_factory=list)
    excluded_tags: list[str] = Field(default_factory=list)
    action_id: str | None = None
    formula_id: str | None = None
    step_id: str | None = None
    same_source_item: bool = False

    @field_validator("required_tags", "excluded_tags")
    @classmethod
    def normalize_tags(cls, value: list[str]) -> list[str]:
        return normalize_formula_tags(value)

    @field_validator("action_id", "formula_id", "step_id")
    @classmethod
    def normalize_id(cls, value: str | None, info: ValidationInfo) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError(f"{info.field_name} must not be empty.")
        return normalized

    @model_validator(mode="after")
    def reject_conflicting_tags(self) -> "FormulaModifierSelectorPayload":
        overlap = set(self.required_tags) & set(self.excluded_tags)
        if overlap:
            tags = ", ".join(sorted(overlap))
            raise ValueError(
                "Formula modifier selector tags cannot be both required and "
                f"excluded: {tags}."
            )
        return self


class FormulaModifierEffectPayload(ProtocolModel):
    operation: Literal["add", "subtract", "multiply", "divide", "set"]
    value: FormulaPayload
    selector: FormulaModifierSelectorPayload = Field(
        default_factory=FormulaModifierSelectorPayload
    )
    type: Literal["formula_modifier"] = "formula_modifier"


class EvaluationFormulaModifierEffectPayload(ProtocolModel):
    operation: Literal["add", "subtract", "multiply", "divide", "set"]
    value: FormulaPayload
    selector: FormulaModifierSelectorPayload = Field(
        default_factory=FormulaModifierSelectorPayload
    )
    type: Literal["evaluation_formula_modifier"] = "evaluation_formula_modifier"


class RollModeModifierEffectPayload(ProtocolModel):
    roll_mode: Literal["advantage", "disadvantage"]
    selector: FormulaModifierSelectorPayload = Field(
        default_factory=FormulaModifierSelectorPayload
    )
    type: Literal["roll_mode_modifier"] = "roll_mode_modifier"


AugmentationEffectPayload = Annotated[
    FormulaModifierEffectPayload
    | EvaluationFormulaModifierEffectPayload
    | RollModeModifierEffectPayload,
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
    lifecycle_owner: Literal["manual", "equipment", "condition", "action"] = "manual"
    lifecycle: AugmentationLifecyclePayload = Field(
        default_factory=AugmentationLifecyclePayload
    )


class StandaloneEffectDefinitionPayload(ProtocolModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    description: str = ""
    scope: Literal["sheet", "instance"] = "instance"
    target: AugmentationTargetPayload
    effect: AugmentationEffectPayload
    active: bool = True
    lifecycle: AugmentationLifecyclePayload = Field(
        default_factory=AugmentationLifecyclePayload
    )


class StandaloneEffectApplicationPayload(ProtocolModel):
    application_id: str
    definition_id: str
    instance_id: str
    source: AugmentationSourcePayload
    active: bool = True


class ItemActionGrantPayload(ProtocolModel):
    action_id: str
    availability: Literal["carried", "equipped"]
    consume_quantity: int = 0


class ItemPayload(ProtocolModel):
    id: str
    name: str
    interaction_type: Literal["equippable", "consumable", "inventory_only"]
    category: str = ""
    rank: str = ""
    description: str
    world_anvil_url: str = ""
    gm_notes: str = ""
    gm_special_properties: str = ""
    price: str
    weight: str
    attribute_profile: Literal["weapon"] | None = None
    augmentation_templates: list[AugmentationPayload] = Field(default_factory=list)
    action_grants: list[ItemActionGrantPayload] = Field(default_factory=list)
    attributes: dict[str, AttributeBridgePayload] = Field(default_factory=dict)


class ConditionPresetPayload(ProtocolModel):
    id: str
    name: str
    description: str = ""
    visibility: Literal["public", "gm_only"] = "public"
    augmentation_ids: list[str] = Field(default_factory=list)
    augmentation_templates: list[AugmentationPayload] = Field(default_factory=list)


class ActiveConditionPayload(ProtocolModel):
    application_id: str
    condition_id: str
    condition_name: str
    description: str = ""
    visibility: Literal["public", "gm_only"] = "public"
    instance_id: str
    augmentation_ids: list[str] = Field(default_factory=list)


class EncounterEntryPayload(ProtocolModel):
    template_id: str
    count: int


class EncounterPresetPayload(ProtocolModel):
    id: str
    name: str
    entries: list[EncounterEntryPayload] = Field(default_factory=list)
    updated_at: str


class BackendStateSnapshotPayload(ProtocolModel):
    action_history: dict[str, ActionHistoryEntryPayload] = Field(default_factory=dict)
    sheets: dict[str, SheetPayload] = Field(default_factory=dict)
    instanced_sheets: dict[str, InstancedSheetPayload] = Field(default_factory=dict)
    formulas: dict[str, FormulaDefinitionPayload] = Field(default_factory=dict)
    attributes: dict[str, AttributeDefinitionPayload] = Field(default_factory=dict)
    actions: dict[str, ActionPayload] = Field(default_factory=dict)
    items: dict[str, ItemPayload] = Field(default_factory=dict)
    proficiencies: dict[str, ProficiencyPayload] = Field(default_factory=dict)
    augmentations: dict[str, AugmentationPayload] = Field(default_factory=dict)
    standalone_effects: dict[str, StandaloneEffectDefinitionPayload] = Field(
        default_factory=dict
    )
    standalone_effect_applications: dict[
        str, StandaloneEffectApplicationPayload
    ] = Field(default_factory=dict)
    condition_presets: dict[str, ConditionPresetPayload] = Field(default_factory=dict)
    active_conditions: dict[str, ActiveConditionPayload] = Field(default_factory=dict)
    encounter_presets: dict[str, EncounterPresetPayload] = Field(default_factory=dict)
