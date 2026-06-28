from dataclasses import dataclass

import pytest

from backend.features.formula_runtime.service import (
    FormulaExecutionContext,
    compose_roll20_message,
    evaluate_numeric_expression,
    evaluate_numeric_formula,
    resolve_roll_mode,
)
from backend.state.models.augmentation import (
    EvaluationFormulaModifierEffect,
    FormulaModifierSelector,
    RollModeModifierEffect,
)
from backend.state.models.formula import (
    Formula,
    FormulaAliases,
    FormulaDefinition,
    normalize_formula_tags,
)
from backend.state.models.proficiency import ProficiencyBridge
from backend.state.models.state import State


@dataclass
class DummyStats:
    strength: int
    mana: int
    derived: Formula


@dataclass
class DummySheet:
    stats: DummyStats
    proficiencies: dict[str, ProficiencyBridge]
    variables: dict[str, object]


def test_formula_tags_are_normalized_deduplicated_and_ordered() -> None:
    assert normalize_formula_tags(
        [" Damage ", "FIRE", "damage", "  ranged   attack  "]
    ) == ["damage", "fire", "ranged attack"]

    formula = Formula(aliases=None, text="1d6", tags=[" FIRE ", "fire"])
    assert formula.tags == ["fire"]


def test_formula_tags_reject_empty_values() -> None:
    with pytest.raises(ValueError, match="must not be empty"):
        Formula(aliases=None, text="1d6", tags=["  "])


def test_formula_deserialization_defaults_legacy_tags_and_persists_them() -> None:
    legacy = FormulaDefinition.from_dict(
        {
            "id": "legacy_formula",
            "formula": {"aliases": None, "text": "1d6"},
        }
    )
    tagged = FormulaDefinition.from_dict(
        {
            "id": "tagged_formula",
            "formula": {
                "aliases": None,
                "text": "1d6",
                "tags": [" Damage ", "FIRE"],
            },
        }
    )

    assert legacy.formula.tags == []
    assert tagged.formula.tags == ["damage", "fire"]

    state = State(formulas={"tagged_formula": tagged})
    assert state.to_dict()["formulas"]["tagged_formula"]["formula"]["tags"] == [
        "damage",
        "fire",
    ]


def test_expand_formula_resolves_attribute_paths_relative_to_root() -> None:
    root = DummySheet(
        stats=DummyStats(
            strength=12,
            mana=20,
            derived=Formula(
                aliases=[FormulaAliases(name="strength", path=["stats", "strength"])],
                text="@strength * 2",
            ),
        ),
        proficiencies={},
        variables={},
    )
    formula = Formula(
        aliases=[
            FormulaAliases(name="strength", path=["stats", "strength"]),
            FormulaAliases(name="mana", path=["stats", "mana"]),
        ],
        text="@strength + @mana",
    )

    assert formula.expand_formula(root) == "(12) + (20)"


def test_expand_formula_resolves_dict_paths_relative_to_root() -> None:
    root = DummySheet(
        stats=DummyStats(
            strength=12,
            mana=20,
            derived=Formula(aliases=None, text="1"),
        ),
        proficiencies={},
        variables={"current_mana": 17},
    )
    formula = Formula(
        aliases=[FormulaAliases(name="mana", path=["variables", "current_mana"])],
        text="@mana - 5",
    )

    assert formula.expand_formula(root) == "(17) - 5"


def test_expand_formula_expands_nested_formula_values() -> None:
    root = DummySheet(
        stats=DummyStats(
            strength=12,
            mana=20,
            derived=Formula(
                aliases=[FormulaAliases(name="strength", path=["stats", "strength"])],
                text="@strength * 2",
            ),
        ),
        proficiencies={},
        variables={},
    )
    formula = Formula(
        aliases=[FormulaAliases(name="derived", path=["stats", "derived"])],
        text="@derived + 3",
    )

    assert formula.expand_formula(root) == "((12) * 2) + 3"


def test_expand_formula_detects_cycles() -> None:
    cyclic_formula = Formula(aliases=None, text="@loop")
    cyclic_formula.aliases = [FormulaAliases(name="loop", path=["variables", "loop"])]
    root = DummySheet(
        stats=DummyStats(
            strength=12,
            mana=20,
            derived=Formula(aliases=None, text="1"),
        ),
        proficiencies={},
        variables={"loop": cyclic_formula},
    )

    with pytest.raises(ValueError, match="Formula expansion cycle detected."):
        cyclic_formula.expand_formula(root)


def test_expand_formula_expands_proficiency_bridge_values() -> None:
    root = DummySheet(
        stats=DummyStats(
            strength=12,
            mana=20,
            derived=Formula(aliases=None, text="1"),
        ),
        proficiencies={
            "magic": ProficiencyBridge(
                relationship_id="bridge-1",
                prof_id="magic",
                use_count=2,
                growth_rate=0.25,
            )
        },
        variables={},
    )
    formula = Formula(
        aliases=[FormulaAliases(name="magic", path=["proficiencies", "magic"])],
        text="@magic",
    )

    assert formula.expand_formula(root) == "(0.5)"


def test_formula_runtime_evaluates_supported_numeric_expression() -> None:
    assert evaluate_numeric_expression("(12 + 8) / 2") == 10
    assert evaluate_numeric_expression("2 ** 3 + 5 % 2") == 9
    assert evaluate_numeric_expression("-4 + +6") == 2


def test_formula_runtime_evaluates_mvp_helper_functions() -> None:
    assert evaluate_numeric_expression("min(12, 8)") == 8
    assert evaluate_numeric_expression("max(0, -4)") == 0
    assert evaluate_numeric_expression("floor(4.9) + ceil(4.1)") == 9
    assert evaluate_numeric_expression("round(2.6)") == 3
    assert evaluate_numeric_expression("round(2.25, 1)") == 2.2


def test_formula_runtime_evaluates_dice_expressions(monkeypatch) -> None:
    rolls = iter([4, 2, 90, 12])
    monkeypatch.setattr(
        "backend.features.formula_runtime.service.random.randint",
        lambda _minimum, _maximum: next(rolls),
    )

    assert evaluate_numeric_expression("1d6 + 2d100kh1") == 94


def test_formula_runtime_evaluates_formula_against_root() -> None:
    root = DummySheet(
        stats=DummyStats(
            strength=12,
            mana=20,
            derived=Formula(aliases=None, text="1"),
        ),
        proficiencies={},
        variables={},
    )
    formula = Formula(
        aliases=[
            FormulaAliases(name="strength", path=["stats", "strength"]),
            FormulaAliases(name="mana", path=["stats", "mana"]),
        ],
        text="(@strength + @mana) / 4",
    )

    assert evaluate_numeric_formula(root, formula) == 8


def test_formula_execution_context_normalizes_formula_and_semantic_tags() -> None:
    context = FormulaExecutionContext.for_formula(
        Formula(aliases=None, text="10", tags=[" Damage ", "FIRE"]),
        action_id="attack",
        step_id="damage-step",
        formula_id="damage-formula",
        semantic_tags=("fire", " Magical "),
    )

    assert context == FormulaExecutionContext(
        action_id="attack",
        step_id="damage-step",
        formula_id="damage-formula",
        tags=("damage", "fire", "magical"),
    )


@pytest.mark.parametrize(
    ("operation", "expected"),
    [
        ("add", 12),
        ("subtract", 8),
        ("multiply", 20),
        ("divide", 5),
        ("set", 2),
    ],
)
def test_formula_runtime_applies_matching_numeric_modifiers(
    operation: str,
    expected: int,
) -> None:
    root = DummySheet(
        stats=DummyStats(
            strength=12,
            mana=20,
            derived=Formula(aliases=None, text="1"),
        ),
        proficiencies={},
        variables={},
    )
    formula = Formula(aliases=None, text="10", tags=["damage"])
    context = FormulaExecutionContext.for_formula(
        formula,
        action_id="attack",
        step_id="damage-step",
        formula_id="damage-formula",
        semantic_tags=("fire",),
    )
    modifier = EvaluationFormulaModifierEffect(
        operation=operation,
        value=Formula(aliases=None, text="2"),
        selector=FormulaModifierSelector(
            required_tags=["damage", "fire"],
            action_id="attack",
            step_id="damage-step",
            formula_id="damage-formula",
        ),
    )

    assert evaluate_numeric_formula(
        root,
        formula,
        execution_context=context,
        modifiers=(modifier,),
    ) == expected

    mismatch = FormulaExecutionContext.for_formula(
        formula,
        action_id="other-action",
        step_id="damage-step",
        formula_id="damage-formula",
        semantic_tags=("fire",),
    )
    assert evaluate_numeric_formula(
        root,
        formula,
        execution_context=mismatch,
        modifiers=(modifier,),
    ) == 10


def test_roll_mode_modifiers_match_context_and_cancel_opposing_sources() -> None:
    formula = Formula(aliases=None, text="1d100", tags=["check", "block"])
    context = FormulaExecutionContext.for_formula(
        formula,
        action_id="block",
        step_id="roll",
    )
    advantage = RollModeModifierEffect(
        roll_mode="advantage",
        selector=FormulaModifierSelector(required_tags=["check", "block"]),
    )

    assert resolve_roll_mode(
        "normal",
        execution_context=context,
        modifiers=(advantage,),
    ) == "advantage"
    assert resolve_roll_mode(
        "disadvantage",
        execution_context=context,
        modifiers=(advantage,),
    ) == "normal"


def test_roll20_composition_applies_numeric_modifier_without_rewriting_formula() -> None:
    root = DummySheet(
        stats=DummyStats(
            strength=12,
            mana=20,
            derived=Formula(aliases=None, text="1"),
        ),
        proficiencies={},
        variables={},
    )
    formula = Formula(
        aliases=[FormulaAliases(name="strength", path=["stats", "strength"])],
        text="Check: /roll (1d100 / 100) * @strength",
        tags=["check", "strength"],
    )
    context = FormulaExecutionContext.for_formula(
        formula,
        action_id="strength-check",
        step_id="roll",
    )
    modifier = EvaluationFormulaModifierEffect(
        operation="add",
        value=Formula(aliases=None, text="2"),
        selector=FormulaModifierSelector(required_tags=["check", "strength"]),
    )

    assert compose_roll20_message(
        root,
        formula,
        execution_context=context,
        modifiers=(modifier,),
    ) == "Check: /roll ((1d100 / 100) * (12)) + (2)"
    assert formula.text == "Check: /roll (1d100 / 100) * @strength"

    plain_message = Formula(
        aliases=None,
        text="Strength check complete",
        tags=["check", "strength"],
    )
    assert compose_roll20_message(
        root,
        plain_message,
        execution_context=FormulaExecutionContext.for_formula(plain_message),
        modifiers=(modifier,),
    ) == "Strength check complete"


def test_formula_runtime_rejects_unsupported_function() -> None:
    with pytest.raises(ValueError, match="Unsupported formula function: abs"):
        evaluate_numeric_expression("abs(-1)")


def test_formula_runtime_rejects_unsupported_operator() -> None:
    with pytest.raises(ValueError, match="Unsupported formula operator: BitAnd"):
        evaluate_numeric_expression("1 & 1")


def test_formula_runtime_rejects_invalid_dice_expressions() -> None:
    with pytest.raises(ValueError, match="Dice keep count cannot exceed dice count."):
        evaluate_numeric_expression("1d20kh2")
