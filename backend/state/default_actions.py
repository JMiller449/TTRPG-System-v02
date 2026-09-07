from __future__ import annotations

from collections.abc import Iterable, Mapping
from copy import deepcopy
from dataclasses import dataclass
from typing import Any, Literal

from backend.state.models.action import Action
from backend.state.models.formula import FormulaDefinition

ActionPresetCategory = Literal[
    "healing",
    "resource",
    "weapon",
    "defense",
    "contest",
    "spell",
]

BASELINE_SHEET_CHECKS: tuple[tuple[str, str], ...] = (
    ("strength", "Strength"),
    ("dexterity", "Dexterity"),
    ("constitution", "Constitution"),
    ("perception", "Perception"),
    ("arcane", "Arcane"),
    ("will", "Will"),
)


@dataclass(frozen=True)
class DefaultSheetActionMetadata:
    action_id: str
    name: str
    description: str


WEAPON_ACTION_IDS: tuple[str, ...] = (
    "weapon_attack",
    "weapon_damage",
    "weapon_parry",
    "weapon_contest",
)


@dataclass(frozen=True)
class CanonicalActionPreset:
    id: str
    label: str
    category: ActionPresetCategory
    description: str
    roll_mode_kind: Literal["none", "check", "damage"]
    message_text: str
    aliases: tuple[tuple[str, tuple[str, ...]], ...]
    tags: tuple[str, ...]
    attribute_values: tuple[tuple[str, dict], ...] = ()
    seed_global: bool = False
    attach_to_new_sheet: bool = False

    @property
    def formula_id(self) -> str:
        return f"default_action_{self.id}_formula"

    def steps(self) -> list[dict]:
        expression = self.message_text.removeprefix(f"{self.label}: /r ")
        presentation = "damage" if self.roll_mode_kind == "damage" else "simple"
        steps = [
            {
                "step_id": "roll",
                "type": "send_roll",
                "title": self.label,
                "presentation": presentation,
                "rolls": [
                    {
                        "label": "Damage" if presentation == "damage" else "Result",
                        "value": {
                            "type": "formula_reference",
                            "formula_id": self.formula_id,
                        },
                    }
                ],
            }
        ]
        return steps

    def action_payload(self) -> dict:
        return {
            "id": self.id,
            "name": self.label,
            "roll_mode_kind": self.roll_mode_kind,
            "notes": self.description,
            "steps": self.steps(),
            "attributes": {},
            "proficiencies": [],
        }

    def action(self) -> Action:
        return Action.from_dict(self.action_payload())

    def formula_definition(self) -> FormulaDefinition:
        expression = self.message_text.removeprefix(f"{self.label}: /r ")
        return FormulaDefinition.from_dict(
            {
                "id": self.formula_id,
                "formula": {
                    "aliases": [
                        {"name": name, "path": list(path)}
                        for name, path in self.aliases
                    ],
                    "text": expression,
                    "tags": list(self.tags),
                },
            }
        )

    def authoring_attribute_values(self) -> dict[str, dict]:
        return {
            attribute_id: deepcopy(value)
            for attribute_id, value in self.attribute_values
        }


_SPELL_ATTRIBUTE_VALUES: tuple[tuple[str, dict], ...] = (
    ("action_mana_cost", {"type": "number", "value": 0}),
    ("action_base_spell_damage", {"type": "number", "value": 0}),
)


CANONICAL_ACTION_PRESETS: tuple[CanonicalActionPreset, ...] = (
    CanonicalActionPreset(
        id="dodge",
        label="Dodge",
        category="defense",
        description="Default editable Dexterity-based Dodge attempt.",
        roll_mode_kind="check",
        message_text="Dodge: /r floor(@dexterity * (1d100 / 100))",
        aliases=(("dexterity", ("sheet", "stats", "dexterity")),),
        tags=("check", "dodge"),
        seed_global=True,
        attach_to_new_sheet=True,
    ),
    CanonicalActionPreset(
        id="block",
        label="Block",
        category="defense",
        description="Default editable Strength-based Block attempt.",
        roll_mode_kind="check",
        message_text="Block: /r floor(@strength * (1d100 / 100))",
        aliases=(("strength", ("sheet", "stats", "strength")),),
        tags=("check", "block"),
        seed_global=True,
        attach_to_new_sheet=True,
    ),
    CanonicalActionPreset(
        id="weapon_attack",
        label="Weapon Attack",
        category="weapon",
        description=(
            "Equipment-grantable weapon to-hit roll using the explicit source "
            "weapon's governing stat. Add action-owned proficiencies as needed."
        ),
        roll_mode_kind="check",
        message_text=(
            "Weapon Attack: /r floor((1d100 / 100) * @weapon_stat)"
        ),
        aliases=(
            ("weapon_stat", ("source_item", "resolved", "governing_stat")),
        ),
        tags=("check", "attack", "weapon"),
        seed_global=True,
    ),
    CanonicalActionPreset(
        id="weapon_damage",
        label="Weapon Damage",
        category="weapon",
        description=(
            "Equipment-grantable weapon damage roll kept separate from the "
            "weapon to-hit action."
        ),
        roll_mode_kind="damage",
        message_text=(
            "Weapon Damage: /r floor(@weapon_base_damage + "
            "(1d100 / 100) * @weapon_stat)"
        ),
        aliases=(
            (
                "weapon_base_damage",
                ("source_item", "attributes", "weapon_base_damage"),
            ),
            ("weapon_stat", ("source_item", "resolved", "governing_stat")),
        ),
        tags=("damage", "weapon"),
        seed_global=True,
    ),
    CanonicalActionPreset(
        id="weapon_parry",
        label="Weapon Parry",
        category="defense",
        description=(
            "Equipment-grantable Parry attempt using one plus the selected weapon "
            "proficiency and Dexterity."
        ),
        roll_mode_kind="check",
        message_text=(
            "Weapon Parry: /r floor((1d100 / 100) * @dexterity)"
        ),
        aliases=(
            ("dexterity", ("sheet", "stats", "dexterity")),
        ),
        tags=("check", "parry", "weapon"),
        seed_global=True,
    ),
    CanonicalActionPreset(
        id="weapon_contest",
        label="Weapon Contest",
        category="contest",
        description=(
            "Equipment-grantable counter Block, Dodge, or Parry contest roll."
        ),
        roll_mode_kind="check",
        message_text=(
            "Weapon Contest: /r floor((1d100 / 100) * @weapon_stat)"
        ),
        aliases=(
            ("weapon_stat", ("source_item", "resolved", "governing_stat")),
        ),
        tags=("check", "contest", "weapon"),
        seed_global=True,
    ),
    CanonicalActionPreset(
        id="spell_to_hit",
        label="Spell To-Hit",
        category="spell",
        description=(
            "Editable spell to-hit preset. Add any action-owned proficiencies "
            "used by the spell formula before saving."
        ),
        roll_mode_kind="check",
        message_text=(
            "Spell To-Hit: /r floor((1d100 / 100) * @arcane)"
        ),
        aliases=(
            ("arcane", ("sheet", "stats", "arcane")),
        ),
        tags=("check", "spell", "attack"),
        attribute_values=_SPELL_ATTRIBUTE_VALUES,
    ),
    CanonicalActionPreset(
        id="spell_damage",
        label="Spell Damage",
        category="spell",
        description=(
            "Editable spell damage preset. Configure action-owned proficiencies "
            "and Base Spell Damage before saving."
        ),
        roll_mode_kind="damage",
        message_text=(
            "Spell Damage: /r floor((1d100 / 100) * @arcane + @base_spell_damage)"
        ),
        aliases=(
            ("arcane", ("sheet", "stats", "arcane")),
            (
                "base_spell_damage",
                ("action", "attributes", "action_base_spell_damage"),
            ),
        ),
        tags=("damage", "spell"),
        attribute_values=_SPELL_ATTRIBUTE_VALUES,
    ),
)


def seeded_global_actions() -> dict[str, Action]:
    return {
        preset.id: preset.action()
        for preset in CANONICAL_ACTION_PRESETS
        if preset.seed_global
    }


def canonical_action_formula_definitions() -> dict[str, FormulaDefinition]:
    return {
        preset.formula_id: preset.formula_definition()
        for preset in CANONICAL_ACTION_PRESETS
    }


def seeded_global_action_payloads() -> dict[str, dict]:
    return {
        preset.id: preset.action_payload()
        for preset in CANONICAL_ACTION_PRESETS
        if preset.seed_global
    }


def default_sheet_action_ids() -> tuple[str, ...]:
    return tuple(
        preset.id
        for preset in CANONICAL_ACTION_PRESETS
        if preset.attach_to_new_sheet
    )


def required_sheet_action_ids() -> tuple[str, ...]:
    return (
        *(f"baseline_check_{stat_name}" for stat_name, _ in BASELINE_SHEET_CHECKS),
        *default_sheet_action_ids(),
    )


def required_sheet_action_metadata() -> tuple[DefaultSheetActionMetadata, ...]:
    baseline_actions = tuple(
        DefaultSheetActionMetadata(
            action_id=f"baseline_check_{stat_name}",
            name=f"{label} Check",
            description="Standard system check included on every sheet.",
        )
        for stat_name, label in BASELINE_SHEET_CHECKS
    )
    preset_actions = tuple(
        DefaultSheetActionMetadata(
            action_id=preset.id,
            name=preset.label,
            description=preset.description,
        )
        for preset in CANONICAL_ACTION_PRESETS
        if preset.attach_to_new_sheet
    )
    return (*baseline_actions, *preset_actions)


def canonical_weapon_action_grant_payloads() -> tuple[dict[str, Any], ...]:
    return tuple(
        {
            "action_id": action_id,
            "availability": "equipped",
            "consume_quantity": 0,
        }
        for action_id in WEAPON_ACTION_IDS
    )


def normalize_weapon_action_grant_payloads(
    grants: Iterable[Mapping[str, Any]],
) -> list[dict[str, Any]]:
    normalized = [
        {
            "action_id": grant["action_id"],
            "availability": grant.get("availability", "equipped"),
            "consume_quantity": grant.get("consume_quantity", 0),
        }
        for grant in grants
        if grant.get("action_id") not in WEAPON_ACTION_IDS
    ]
    normalized.extend(deepcopy(list(canonical_weapon_action_grant_payloads())))
    return normalized
