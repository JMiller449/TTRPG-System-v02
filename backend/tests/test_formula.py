from dataclasses import dataclass

import pytest

from backend.features.formula_runtime.service import (
    evaluate_numeric_expression,
    evaluate_numeric_formula,
)
from backend.state.models.formula import Formula, FormulaAliases
from backend.state.models.proficiency import ProficiencyBridge


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


def test_formula_runtime_rejects_unsupported_expression() -> None:
    with pytest.raises(ValueError, match="Unsupported formula expression: Call"):
        evaluate_numeric_expression("round(1.2)")


def test_formula_runtime_rejects_unsupported_operator() -> None:
    with pytest.raises(ValueError, match="Unsupported formula operator: BitAnd"):
        evaluate_numeric_expression("1 & 1")
