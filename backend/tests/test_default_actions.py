from types import SimpleNamespace

from backend.state.default_actions import (
    CANONICAL_ACTION_PRESETS,
    default_sheet_action_ids,
    seeded_global_actions,
)


def test_canonical_action_seeding_attaches_only_defense_defaults() -> None:
    actions = seeded_global_actions()

    assert set(actions) == {
        "dodge",
        "block",
        "weapon_attack",
        "weapon_damage",
        "weapon_parry",
        "weapon_contest",
    }
    assert default_sheet_action_ids() == ("dodge", "block")
    assert "attack" not in actions
    assert "parry" not in actions
    assert actions["block"].steps[0].message.aliases[0].path == [
        "sheet",
        "stats",
        "strength",
    ]


def test_canonical_spreadsheet_formulas_expand_to_roll20_expressions() -> None:
    root = SimpleNamespace(
        sheet=SimpleNamespace(
            stats=SimpleNamespace(
                strength=25,
                dexterity=26,
                arcane=28,
            )
        ),
        source_item={
            "attributes": {"weapon_base_damage": 15},
            "resolved": {
                "governing_stat": 25,
                "proficiency_modifier": 0.8,
            },
        },
        action={
            "attributes": {"action_base_spell_damage": 10},
            "resolved": {"proficiency_modifier": 0.5},
        },
    )
    presets = {preset.id: preset for preset in CANONICAL_ACTION_PRESETS}
    expected = {
        "dodge": "Dodge: /r floor((26) * (1d100 / 100))",
        "block": "Block: /r floor((25) * (1d100 / 100))",
        "weapon_attack": (
            "Weapon Attack: /r floor((1 + (0.8)) * "
            "(1d100 / 100) * (25))"
        ),
        "weapon_damage": (
            "Weapon Damage: /r floor((15) + (1 + (0.8)) * "
            "(1d100 / 100) * (25))"
        ),
        "weapon_parry": "Weapon Parry: /r floor((0.8) * (1d100 / 100) * (26))",
        "weapon_contest": "Weapon Contest: /r floor((0.8) * (1d100 / 100) * (25))",
        "spell_to_hit": (
            "Spell To-Hit: /r floor((1 + (0.5)) * (1d100 / 100) * (28))"
        ),
        "spell_damage": (
            "Spell Damage: /r floor((1 + (0.5)) * "
            "(1d100 / 100) * (28) + (10))"
        ),
    }

    for preset_id, expected_message in expected.items():
        formula = presets[preset_id].action().steps[0].message
        assert formula.expand_formula(root) == expected_message


def test_canonical_action_tags_support_existing_modifier_selectors() -> None:
    presets = {preset.id: preset for preset in CANONICAL_ACTION_PRESETS}

    assert presets["weapon_attack"].tags == ("check", "attack", "weapon")
    assert presets["weapon_parry"].tags == ("check", "parry", "weapon")
    assert presets["spell_damage"].tags == ("damage", "spell")
