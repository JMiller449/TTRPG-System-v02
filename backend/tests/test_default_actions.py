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
    assert actions["block"].steps[0].rolls[0].value.aliases[0].path == [
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
        "dodge": "floor((26) * (1d100 / 100))",
        "block": "floor((25) * (1d100 / 100))",
        "weapon_attack": (
            "floor((1 + (0.8)) * "
            "(1d100 / 100) * (25))"
        ),
        "weapon_damage": (
            "floor((15) + (1 + (0.8)) * "
            "(1d100 / 100) * (25))"
        ),
        "weapon_parry": (
            "floor((1 + (0.8)) * (1d100 / 100) * (26))"
        ),
        "weapon_contest": (
            "floor((1 + (0.8)) * (1d100 / 100) * (25))"
        ),
        "spell_to_hit": (
            "floor((1 + (0.5)) * (1d100 / 100) * (28))"
        ),
        "spell_damage": (
            "floor((1 + (0.5)) * "
            "(1d100 / 100) * (28) + (10))"
        ),
    }

    for preset_id, expected_message in expected.items():
        formula = presets[preset_id].action().steps[0].rolls[0].value
        assert formula.expand_formula(root) == expected_message


def test_canonical_action_tags_support_existing_modifier_selectors() -> None:
    presets = {preset.id: preset for preset in CANONICAL_ACTION_PRESETS}

    assert presets["weapon_attack"].tags == ("check", "attack", "weapon")
    assert presets["weapon_parry"].tags == ("check", "parry", "weapon")
    assert presets["spell_damage"].tags == ("damage", "spell")
