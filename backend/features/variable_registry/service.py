from __future__ import annotations

from typing import Literal

from backend.core.permissions import permission_allowed_roles
from backend.features.variable_registry.schema import (
    ActionFormulaAuthoringMetadata,
    ActionAttributePreset,
    ActionPresetTemplate,
    ActionStepAuthoringMetadata,
    AugmentationTargetContext,
    AugmentationTargetMetadata,
    AugmentationTargetMetadataResponse,
    AuthoringVariablePathMetadata,
    FormulaAliasMetadata,
    AttributeFormulaVariablePathMetadata,
    SheetFormulaStatDefaultMetadata,
    VariableEditableRole,
    VariablePathMetadata,
    VariableRegistry,
    VariableRoot,
    DefaultSheetActionMetadata,
)
from backend.state.default_actions import (
    CANONICAL_ACTION_PRESETS,
    required_sheet_action_metadata,
)
from backend.state.models.attribute import (
    ACTION_BASE_SPELL_DAMAGE_ATTRIBUTE_ID,
    ACTION_MANA_COST_ATTRIBUTE_ID,
    ACTION_PROFICIENCY_ATTRIBUTE_ID,
    ACTION_RANGE_ATTRIBUTE_ID,
    ACTION_TARGET_COUNT_ATTRIBUTE_ID,
    WEAPON_BASE_DAMAGE_ATTRIBUTE_ID,
    WEAPON_PROFICIENCY_ATTRIBUTE_ID,
    AttributeDefinition,
)
from backend.state.models.state import State
from backend.state.models.stat import default_sheet_formula_stats

_BASE_STATS: tuple[tuple[str, str, tuple[str, ...]], ...] = (
    ("strength", "Strength", ("str", "strength")),
    ("dexterity", "Dexterity", ("dex", "dexterity")),
    ("constitution", "Constitution", ("con", "constitution")),
    ("perception", "Perception", ("per", "perception")),
    ("arcane", "Arcane", ("arc", "arcane")),
    ("will", "Will", ("will",)),
)

_FORMULA_STATS: tuple[tuple[str, str], ...] = (
    ("lifting", "Lifting"),
    ("carry_weight", "Carry Weight"),
    ("acrobatics", "Acrobatics"),
    ("stamina", "Stamina"),
    ("reaction_time", "Reaction Time"),
    ("health", "Health Formula"),
    ("endurance", "Endurance"),
    ("pain_tolerance", "Pain Tolerance"),
    ("sight_distance", "Sight Distance"),
    ("intuition", "Intuition"),
    ("registration", "Registration"),
    ("mana", "Mana Formula"),
    ("control", "Control"),
    ("sensitivity", "Sensitivity"),
    ("charisma", "Charisma"),
    ("mental_fortitude", "Mental Fortitude"),
    ("courage", "Courage"),
)

_RESISTANCES: tuple[tuple[str, str, tuple[str, ...]], ...] = (
    ("resistance", "Total Resistance", ("resistance",)),
    ("physical", "Physical Resistance", ("physical_resistance",)),
    ("magical", "Magical Resistance", ("magical_resistance",)),
    ("slashing", "Slashing Resistance", ("slashing_resistance",)),
    ("bludgeoning", "Bludgeoning Resistance", ("bludgeoning_resistance",)),
    ("piercing", "Piercing Resistance", ("piercing_resistance",)),
    ("arcane", "Arcane Resistance", ("arcane_resistance",)),
    ("fire", "Fire Resistance", ("fire_resistance",)),
    ("water", "Water Resistance", ("water_resistance",)),
    ("earth", "Earth Resistance", ("earth_resistance",)),
    ("wind", "Wind Resistance", ("wind_resistance",)),
    ("light", "Light Resistance", ("light_resistance",)),
    ("dark", "Dark Resistance", ("dark_resistance",)),
    ("lightning", "Lightning Resistance", ("lightning_resistance",)),
    ("ice", "Ice Resistance", ("ice_resistance",)),
    ("time", "Time Resistance", ("time_resistance",)),
    ("gravity", "Gravity Resistance", ("gravity_resistance",)),
    ("psychic", "Psychic Resistance", ("psychic_resistance",)),
)

_DM_ONLY: list[VariableEditableRole] = list(permission_allowed_roles("stat_edit"))
_PLAYER_AND_DM: list[VariableEditableRole] = list(
    permission_allowed_roles("resource_edit")
)
_ROOT_ORDER: tuple[VariableRoot, ...] = (
    "state",
    "sheet",
    "instance",
    "action",
    "source_item",
)

_ACTION_ATTRIBUTE_SHORTCUTS: dict[str, tuple[str, ...]] = {
    ACTION_RANGE_ATTRIBUTE_ID: ("action_range",),
    ACTION_TARGET_COUNT_ATTRIBUTE_ID: ("action_target_count",),
    ACTION_MANA_COST_ATTRIBUTE_ID: ("mana_cost",),
    ACTION_BASE_SPELL_DAMAGE_ATTRIBUTE_ID: ("base_spell_damage",),
}

_SOURCE_ITEM_ATTRIBUTE_SHORTCUTS: dict[str, tuple[str, ...]] = {
    WEAPON_BASE_DAMAGE_ATTRIBUTE_ID: ("weapon_base_damage",),
}


_ACTION_STEPS: tuple[ActionStepAuthoringMetadata, ...] = (
    ActionStepAuthoringMetadata(
        type="calculate_value",
        label="Calculate reusable action value",
        category="calculation",
        allowed_targets=["caster"],
        formula_fields=["value"],
        path_catalog="none",
    ),
    ActionStepAuthoringMetadata(
        type="send_message",
        label="Send Roll20 message",
        category="roll20_output",
        allowed_targets=["caster"],
        formula_fields=["message"],
        path_catalog="none",
    ),
    ActionStepAuthoringMetadata(
        type="set_value",
        label="Set bounded variable value",
        category="bounded_mutation",
        allowed_targets=["caster"],
        formula_fields=["value", "min_value", "max_value"],
        path_catalog="variable_mutation_paths",
    ),
    ActionStepAuthoringMetadata(
        type="increment_value",
        label="Increment bounded variable value",
        category="bounded_mutation",
        allowed_targets=["caster"],
        formula_fields=["amount", "min_value", "max_value"],
        path_catalog="variable_mutation_paths",
    ),
    ActionStepAuthoringMetadata(
        type="decrement_value",
        label="Decrement bounded variable value",
        category="bounded_mutation",
        allowed_targets=["caster"],
        formula_fields=["amount", "min_value", "max_value"],
        path_catalog="variable_mutation_paths",
    ),
    ActionStepAuthoringMetadata(
        type="resolve_damage",
        label="Resolve damage",
        category="semantic_mutation",
        allowed_targets=["caster"],
        formula_fields=["amount"],
        path_catalog="none",
    ),
    ActionStepAuthoringMetadata(
        type="gain_proficiency_use",
        label="Gain proficiency use",
        category="semantic_mutation",
        allowed_targets=["caster"],
        formula_fields=["amount"],
        path_catalog="proficiency_bridges",
    ),
    ActionStepAuthoringMetadata(
        type="apply_augmentation",
        label="Apply or remove augmentation",
        category="semantic_mutation",
        allowed_targets=["caster"],
        formula_fields=[],
        path_catalog="augmentation_records",
    ),
    ActionStepAuthoringMetadata(
        type="apply_condition_preset",
        label="Apply or remove condition preset",
        category="semantic_mutation",
        allowed_targets=["caster"],
        formula_fields=[],
        path_catalog="condition_presets",
    ),
)


def _formula_payload(text: str) -> dict:
    return {
        "aliases": None,
        "text": text,
    }


_ACTION_PRESET_TEMPLATES: tuple[ActionPresetTemplate, ...] = (
    ActionPresetTemplate(
        id="heal_health",
        label="Heal health",
        category="healing",
        description=(
            "Adds an authored amount to current instance health. Add a max-value "
            "clamp when the sheet has a canonical max-health formula/path."
        ),
        steps=[
            {
                "step_id": "heal-health",
                "type": "increment_value",
                "target": "caster",
                "path": ["health"],
                "amount": _formula_payload("0"),
                "min_value": _formula_payload("0"),
                "max_value": None,
                "on_min_violation": "clamp",
                "on_max_violation": "clamp",
            }
        ],
        editable_formula_fields=["steps.0.amount", "steps.0.max_value"],
    ),
    ActionPresetTemplate(
        id="spend_mana",
        label="Spend mana",
        category="resource",
        description=(
            "Subtracts an authored amount from current instance mana and rejects "
            "the action if mana would go below zero."
        ),
        steps=[
            {
                "step_id": "spend-mana",
                "type": "decrement_value",
                "target": "caster",
                "path": ["mana"],
                "amount": _formula_payload("0"),
                "min_value": _formula_payload("0"),
                "max_value": None,
                "on_min_violation": "reject",
                "on_max_violation": "clamp",
            }
        ],
        editable_formula_fields=["steps.0.amount"],
    ),
    ActionPresetTemplate(
        id="restore_mana",
        label="Restore mana",
        category="resource",
        description=(
            "Adds an authored amount to current instance mana. Add a max-value "
            "clamp when the sheet has a canonical max-mana formula/path."
        ),
        steps=[
            {
                "step_id": "restore-mana",
                "type": "increment_value",
                "target": "caster",
                "path": ["mana"],
                "amount": _formula_payload("0"),
                "min_value": _formula_payload("0"),
                "max_value": None,
                "on_min_violation": "clamp",
                "on_max_violation": "clamp",
            }
        ],
        editable_formula_fields=["steps.0.amount", "steps.0.max_value"],
    ),
    *(
        ActionPresetTemplate(
            id=preset.id,
            label=preset.label,
            category=preset.category,
            description=preset.description,
            steps=preset.steps(),
            editable_formula_fields=["steps.0.message"],
            roll_mode_kind=preset.roll_mode_kind,
            attribute_values=preset.authoring_attribute_values(),
        )
        for preset in CANONICAL_ACTION_PRESETS
    ),
)


_ACTION_ATTRIBUTE_PRESETS: tuple[ActionAttributePreset, ...] = (
    ActionAttributePreset(
        id="action_details",
        label="General Action Details",
        description="Adds rank, range, target count, and area as display/manual Attributes.",
        attribute_values={
            "action_rank": {"type": "enum", "value": "F"},
            "action_range": {"type": "number", "value": 0},
            "action_target_count": {"type": "number", "value": 1},
            "action_area": {"type": "text", "value": ""},
        },
    ),
    ActionAttributePreset(
        id="spell_details",
        label="Spell Details",
        description=(
            "Adds mana cost, base spell damage, and proficiency configuration. "
            "These remain authored inputs until an action formula consumes them."
        ),
        attribute_values={
            "action_mana_cost": {"type": "number", "value": 0},
            "action_base_spell_damage": {"type": "number", "value": 0},
            "action_proficiency": {"type": "reference", "value": ""},
        },
    ),
)


def _sheet_base_stat(
    name: str,
    label: str,
    shortcuts: tuple[str, ...],
) -> VariablePathMetadata:
    return VariablePathMetadata(
        key=f"sheet.stats.{name}",
        label=label,
        root="sheet",
        path=["stats", name],
        value_type="number",
        editable_roles=_DM_ONLY,
        description=f"Base sheet stat: {label}.",
        shortcuts=list(shortcuts),
    )


def _sheet_formula_stat(name: str, label: str) -> VariablePathMetadata:
    return VariablePathMetadata(
        key=f"sheet.stats.{name}",
        label=label,
        root="sheet",
        path=["stats", name],
        value_type="formula",
        editable_roles=_DM_ONLY,
        formula_backed=True,
        description=f"Formula-backed sheet stat: {label}.",
    )


def _instance_resource(name: str, label: str) -> VariablePathMetadata:
    shortcuts = ("hp", "health") if name == "health" else ("mana",)
    return VariablePathMetadata(
        key=f"instance.{name}",
        label=label,
        root="instance",
        path=[name],
        value_type="resource",
        editable_roles=_PLAYER_AND_DM,
        description=f"Current instance resource: {label}.",
        shortcuts=list(shortcuts),
    )


def _resistance_variable(
    *,
    root: VariableRoot,
    name: str,
    label: str,
    shortcuts: tuple[str, ...],
) -> VariablePathMetadata:
    editable_roles = _DM_ONLY if root == "sheet" else _PLAYER_AND_DM
    return VariablePathMetadata(
        key=f"{root}.resistances.{name}",
        label=label if root == "sheet" else f"Current {label}",
        root=root,
        path=["resistances", name],
        value_type="percent",
        editable_roles=editable_roles,
        description=(
            "Resistance fraction; 0.25 means 25 percent. Effective damage "
            "resistance later combines total, category, and damage-type values."
        ),
        shortcuts=list(shortcuts),
    )


def build_variable_registry(*, request_id: str | None = None) -> VariableRegistry:
    variables = [
        *[
            _sheet_base_stat(name, label, shortcuts)
            for name, label, shortcuts in _BASE_STATS
        ],
        *[_sheet_formula_stat(name, label) for name, label in _FORMULA_STATS],
        *[
            _resistance_variable(
                root="sheet",
                name=name,
                label=label,
                shortcuts=shortcuts,
            )
            for name, label, shortcuts in _RESISTANCES
        ],
        _instance_resource("health", "Current Health"),
        _instance_resource("mana", "Current Mana"),
        *[
            _resistance_variable(
                root="instance",
                name=name,
                label=label,
                shortcuts=tuple(f"current_{shortcut}" for shortcut in shortcuts),
            )
            for name, label, shortcuts in _RESISTANCES
        ],
    ]
    return VariableRegistry(
        response_id=None,
        variables=variables,
        request_id=request_id,
    )


def _action_mutation_allowed(variable: VariablePathMetadata) -> bool:
    if variable.formula_backed:
        return False
    return variable.value_type in {"number", "percent", "resource"}


def _authoring_variable(
    variable: VariablePathMetadata,
) -> AuthoringVariablePathMetadata:
    shortcuts = None if variable.shortcuts is None else list(variable.shortcuts)
    return AuthoringVariablePathMetadata(
        key=variable.key,
        label=variable.label,
        root=variable.root,
        path=list(variable.path),
        value_type=variable.value_type,
        editable_roles=list(variable.editable_roles),
        formula_backed=variable.formula_backed,
        description=variable.description,
        shortcuts=shortcuts,
        formula_reference_allowed=True,
        action_mutation_allowed=_action_mutation_allowed(variable),
    )


def _attribute_authoring_variable(
    definition: AttributeDefinition,
    *,
    root: Literal["action", "source_item"],
) -> AuthoringVariablePathMetadata:
    shortcuts_by_root = (
        _ACTION_ATTRIBUTE_SHORTCUTS if root == "action" else _SOURCE_ITEM_ATTRIBUTE_SHORTCUTS
    )
    subject_label = "Action" if root == "action" else "Source Item"
    return AuthoringVariablePathMetadata(
        key=f"{root}.attributes.{definition.id}",
        label=f"{subject_label}: {definition.name}",
        root=root,
        path=["attributes", definition.id],
        value_type="number",
        editable_roles=[],
        formula_backed=definition.default_value.type == "formula",
        description=(
            f"Evaluated {subject_label.lower()} Attribute. "
            + (definition.description or definition.name)
        ),
        shortcuts=list(
            shortcuts_by_root.get(definition.id, (f"{root}_{definition.id}",))
        ),
        formula_reference_allowed=True,
        action_mutation_allowed=False,
    )


def _resolved_authoring_variables() -> list[AuthoringVariablePathMetadata]:
    return [
        AuthoringVariablePathMetadata(
            key="action.resolved.proficiency_modifier",
            label="Action: Proficiency Modifier",
            root="action",
            path=["resolved", "proficiency_modifier"],
            value_type="number",
            editable_roles=[],
            formula_backed=True,
            description=(
                "Current sheet proficiency modifier selected by the Action "
                "Proficiency Attribute."
            ),
            shortcuts=["action_proficiency", "spell_proficiency"],
            action_mutation_allowed=False,
        ),
        AuthoringVariablePathMetadata(
            key="source_item.resolved.governing_stat",
            label="Source Weapon: Governing Stat Value",
            root="source_item",
            path=["resolved", "governing_stat"],
            value_type="number",
            editable_roles=[],
            formula_backed=True,
            description=(
                "Current sheet stat value selected by the eligible source weapon's "
                "Governing Stat Attribute."
            ),
            shortcuts=["weapon_stat"],
            action_mutation_allowed=False,
        ),
        AuthoringVariablePathMetadata(
            key="source_item.resolved.proficiency_modifier",
            label="Source Weapon: Proficiency Modifier",
            root="source_item",
            path=["resolved", "proficiency_modifier"],
            value_type="number",
            editable_roles=[],
            formula_backed=True,
            description=(
                "Current sheet proficiency modifier selected by the eligible "
                "source weapon's Proficiency Attribute."
            ),
            shortcuts=["weapon_proficiency"],
            action_mutation_allowed=False,
        ),
    ]


def _augmentation_target_contexts(
    variable: VariablePathMetadata,
) -> list[AugmentationTargetContext]:
    if not _action_mutation_allowed(variable):
        return []
    if variable.root == "state":
        return []

    contexts: list[AugmentationTargetContext] = ["runtime"]
    if variable.root in {"sheet", "instance"}:
        contexts.append("item_template")
    if variable.root == "instance":
        contexts.append("condition_template")
    return contexts


def build_augmentation_target_catalog(
    *,
    context: AugmentationTargetContext | None = None,
) -> list[AugmentationTargetMetadata]:
    targets: list[AugmentationTargetMetadata] = []
    for variable in build_variable_registry().variables:
        contexts = _augmentation_target_contexts(variable)
        if not contexts:
            continue
        if context is not None and context not in contexts:
            continue

        targets.append(
            AugmentationTargetMetadata(
                key=variable.key,
                label=variable.label,
                root=variable.root,
                path=list(variable.path),
                value_type=variable.value_type,
                description=variable.description,
                allowed_contexts=list(contexts),
            )
        )
    return targets


def build_augmentation_target_metadata(
    *,
    context: AugmentationTargetContext | None = None,
    request_id: str | None = None,
) -> AugmentationTargetMetadataResponse:
    return AugmentationTargetMetadataResponse(
        response_id=None,
        targets=build_augmentation_target_catalog(context=context),
        context=context,
        request_id=request_id,
    )


def is_augmentation_target_allowed(
    *,
    root: VariableRoot,
    path: list[str],
    context: AugmentationTargetContext,
) -> bool:
    return any(
        target.root == root and target.path == path
        for target in build_augmentation_target_catalog(context=context)
    )


def _formula_aliases(
    variables: list[AuthoringVariablePathMetadata],
) -> list[FormulaAliasMetadata]:
    aliases: list[FormulaAliasMetadata] = []
    for variable in variables:
        for shortcut in variable.shortcuts or []:
            aliases.append(
                FormulaAliasMetadata(
                    name=shortcut,
                    key=variable.key,
                    root=variable.root,
                    path=list(variable.path),
                )
            )
    return aliases


def _attribute_formula_variables(
    state: State,
    *,
    include_gm_only: bool,
) -> list[AttributeFormulaVariablePathMetadata]:
    variables = [
        AttributeFormulaVariablePathMetadata(
            key=f"attribute_formula.{variable.key}",
            label=variable.label,
            subject_types=["sheet"],
            path=list(variable.path),
            value_type=variable.value_type,
            description=variable.description,
            shortcuts=(
                None if variable.shortcuts is None else list(variable.shortcuts)
            ),
        )
        for variable in build_variable_registry().variables
        if variable.root == "sheet"
        and variable.value_type in {"number", "percent", "formula"}
    ]
    variables.extend(
        AttributeFormulaVariablePathMetadata(
            key=f"attribute_formula.attributes.{definition.id}",
            label=f"Attribute: {definition.name}",
            subject_types=list(definition.subject_types),
            path=["attributes", definition.id],
            value_type="number",
            description=definition.description,
            shortcuts=[definition.id],
        )
        for definition in state.attributes.values()
        if definition.value_type == "number"
        and (include_gm_only or definition.visibility == "public")
    )
    return variables


def _ordered_roots(roots: set[VariableRoot]) -> list[VariableRoot]:
    return [root for root in _ROOT_ORDER if root in roots]


def build_action_formula_authoring_metadata(
    *,
    state: State | None = None,
    include_gm_only: bool = True,
    request_id: str | None = None,
) -> ActionFormulaAuthoringMetadata:
    if state is None:
        from backend.state.store import StateSingleton

        state = StateSingleton.getState()
    variables = [
        _authoring_variable(variable)
        for variable in build_variable_registry().variables
    ]
    variables.extend(
        _attribute_authoring_variable(definition, root="action")
        for definition in state.attributes.values()
        if definition.value_type == "number"
        and (include_gm_only or definition.visibility == "public")
        and "action" in definition.subject_types
    )
    variables.extend(
        _attribute_authoring_variable(definition, root="source_item")
        for definition in state.attributes.values()
        if definition.value_type == "number"
        and (include_gm_only or definition.visibility == "public")
        and "item" in definition.subject_types
    )
    if ACTION_PROFICIENCY_ATTRIBUTE_ID in state.attributes:
        variables.extend(_resolved_authoring_variables())
    return ActionFormulaAuthoringMetadata(
        response_id=None,
        variables=variables,
        formula_roots=_ordered_roots(
            {
                variable.root
                for variable in variables
                if variable.formula_reference_allowed
            }
        ),
        action_mutation_roots=_ordered_roots(
            {
                variable.root
                for variable in variables
                if variable.action_mutation_allowed
            }
        ),
        formula_aliases=_formula_aliases(variables),
        action_steps=list(_ACTION_STEPS),
        action_preset_templates=list(_ACTION_PRESET_TEMPLATES),
        action_attribute_presets=list(_ACTION_ATTRIBUTE_PRESETS),
        default_sheet_actions=[
            DefaultSheetActionMetadata(
                action_id=entry.action_id,
                name=entry.name,
                description=entry.description,
            )
            for entry in required_sheet_action_metadata()
        ],
        attribute_formula_variables=_attribute_formula_variables(
            state,
            include_gm_only=include_gm_only,
        ),
        sheet_formula_stat_defaults=[
            SheetFormulaStatDefaultMetadata(stat_name=stat_name, formula=formula)
            for stat_name, formula in default_sheet_formula_stats().items()
        ],
        request_id=request_id,
    )
