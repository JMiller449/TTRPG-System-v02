from __future__ import annotations

from backend.features.variable_registry.schema import (
    VariableEditableRole,
    VariablePathMetadata,
    VariableRegistry,
)

_BASE_STATS: tuple[tuple[str, str], ...] = (
    ("strength", "Strength"),
    ("dexterity", "Dexterity"),
    ("constitution", "Constitution"),
    ("perception", "Perception"),
    ("arcane", "Arcane"),
    ("will", "Will"),
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

_DM_ONLY: list[VariableEditableRole] = ["dm"]
_PLAYER_AND_DM: list[VariableEditableRole] = ["player", "dm"]


def _sheet_base_stat(name: str, label: str) -> VariablePathMetadata:
    return VariablePathMetadata(
        key=f"sheet.stats.{name}",
        label=label,
        root="sheet",
        path=["stats", name],
        value_type="number",
        editable_roles=_DM_ONLY,
        description=f"Base sheet stat: {label}.",
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
    return VariablePathMetadata(
        key=f"instance.{name}",
        label=label,
        root="instance",
        path=[name],
        value_type="resource",
        editable_roles=_PLAYER_AND_DM,
        description=f"Current instance resource: {label}.",
    )


def build_variable_registry(*, request_id: str | None = None) -> VariableRegistry:
    variables = [
        *[_sheet_base_stat(name, label) for name, label in _BASE_STATS],
        *[_sheet_formula_stat(name, label) for name, label in _FORMULA_STATS],
        _instance_resource("health", "Current Health"),
        _instance_resource("mana", "Current Mana"),
    ]
    return VariableRegistry(
        response_id=None,
        variables=variables,
        request_id=request_id,
    )
