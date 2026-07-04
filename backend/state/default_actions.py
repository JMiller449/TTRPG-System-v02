from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from typing import Literal

from backend.state.models.action import Action

ActionPresetCategory = Literal[
    "healing",
    "resource",
    "weapon",
    "defense",
    "contest",
    "spell",
]


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

    def steps(self) -> list[dict]:
        return [
            {
                "step_id": "roll",
                "type": "send_message",
                "message": {
                    "aliases": [
                        {"name": name, "path": list(path)}
                        for name, path in self.aliases
                    ],
                    "text": self.message_text,
                    "tags": list(self.tags),
                },
            }
        ]

    def action_payload(self) -> dict:
        return {
            "id": self.id,
            "name": self.label,
            "roll_mode_kind": self.roll_mode_kind,
            "notes": self.description,
            "steps": self.steps(),
            "attributes": {},
        }

    def action(self) -> Action:
        return Action.from_dict(self.action_payload())

    def authoring_attribute_values(self) -> dict[str, dict]:
        return {
            attribute_id: deepcopy(value)
            for attribute_id, value in self.attribute_values
        }


_SPELL_ATTRIBUTE_VALUES: tuple[tuple[str, dict], ...] = (
    ("action_mana_cost", {"type": "number", "value": 0}),
    ("action_base_spell_damage", {"type": "number", "value": 0}),
    ("action_proficiency", {"type": "reference", "value": ""}),
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
            "weapon's proficiency and governing stat."
        ),
        roll_mode_kind="check",
        message_text=(
            "Weapon Attack: /r floor((1 + @weapon_proficiency) * "
            "(1d100 / 100) * @weapon_stat)"
        ),
        aliases=(
            (
                "weapon_proficiency",
                ("source_item", "resolved", "proficiency_modifier"),
            ),
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
            "(1 + @weapon_proficiency) * (1d100 / 100) * @weapon_stat)"
        ),
        aliases=(
            (
                "weapon_base_damage",
                ("source_item", "attributes", "weapon_base_damage"),
            ),
            (
                "weapon_proficiency",
                ("source_item", "resolved", "proficiency_modifier"),
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
            "Spreadsheet Weapon Parry attempt: proficiency times d100 fraction "
            "times Dexterity. This intentionally differs from the prose Parry rule."
        ),
        roll_mode_kind="check",
        message_text=(
            "Weapon Parry: /r floor(@weapon_proficiency * "
            "(1d100 / 100) * @dexterity)"
        ),
        aliases=(
            (
                "weapon_proficiency",
                ("source_item", "resolved", "proficiency_modifier"),
            ),
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
            "Weapon Contest: /r floor(@weapon_proficiency * "
            "(1d100 / 100) * @weapon_stat)"
        ),
        aliases=(
            (
                "weapon_proficiency",
                ("source_item", "resolved", "proficiency_modifier"),
            ),
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
            "Editable spell to-hit preset. Select an Action Proficiency Attribute "
            "before saving."
        ),
        roll_mode_kind="check",
        message_text=(
            "Spell To-Hit: /r floor((1 + @spell_proficiency) * "
            "(1d100 / 100) * @arcane)"
        ),
        aliases=(
            (
                "spell_proficiency",
                ("action", "resolved", "proficiency_modifier"),
            ),
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
            "Editable spell damage preset. Configure Action Proficiency and Base "
            "Spell Damage Attributes before saving."
        ),
        roll_mode_kind="damage",
        message_text=(
            "Spell Damage: /r floor((1 + @spell_proficiency) * "
            "(1d100 / 100) * @arcane + @base_spell_damage)"
        ),
        aliases=(
            (
                "spell_proficiency",
                ("action", "resolved", "proficiency_modifier"),
            ),
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
