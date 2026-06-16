from __future__ import annotations

from backend.core.permissions import permission_allowed_roles
from backend.features.variable_registry.schema import (
    ActionFormulaAuthoringMetadata,
    ActionPresetTemplate,
    ActionStepAuthoringMetadata,
    AuthoringVariablePathMetadata,
    FormulaAliasMetadata,
    VariableEditableRole,
    VariablePathMetadata,
    VariableRegistry,
    VariableRoot,
)

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
_ROOT_ORDER: tuple[VariableRoot, ...] = ("state", "sheet", "instance")


_ACTION_STEPS: tuple[ActionStepAuthoringMetadata, ...] = (
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


def _ordered_roots(roots: set[VariableRoot]) -> list[VariableRoot]:
    return [root for root in _ROOT_ORDER if root in roots]


def build_action_formula_authoring_metadata(
    *,
    request_id: str | None = None,
) -> ActionFormulaAuthoringMetadata:
    variables = [
        _authoring_variable(variable)
        for variable in build_variable_registry().variables
    ]
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
        request_id=request_id,
    )
