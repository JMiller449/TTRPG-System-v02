from __future__ import annotations

import ast
import math
import random
import re
from dataclasses import dataclass
from typing import Any

from backend.state.models.augmentation import (
    EvaluationFormulaModifierEffect,
    RollModeModifierEffect,
)
from backend.state.models.formula import Formula, normalize_formula_tags

_DICE_PATTERN = re.compile(
    r"(?<![A-Za-z0-9_])(?P<count>\d*)d(?P<sides>\d+)"
    r"(?:(?P<keep>kh|kl)(?P<keep_count>\d+))?(?![A-Za-z0-9_])",
    flags=re.IGNORECASE,
)
_ROLL20_COMMAND_PATTERN = re.compile(
    r"(?P<prefix>.*?/(?:roll|r)\s+)(?P<expression>.+)$",
    flags=re.IGNORECASE,
)
_MAX_DICE_COUNT = 100
_MAX_DICE_SIDES = 100_000

_ALLOWED_BINARY_OPERATORS = {
    ast.Add: lambda left, right: left + right,
    ast.Sub: lambda left, right: left - right,
    ast.Mult: lambda left, right: left * right,
    ast.Div: lambda left, right: left / right,
    ast.FloorDiv: lambda left, right: left // right,
    ast.Mod: lambda left, right: left % right,
    ast.Pow: lambda left, right: left**right,
}
_ALLOWED_UNARY_OPERATORS = {
    ast.UAdd: lambda value: value,
    ast.USub: lambda value: -value,
}
_ALLOWED_FUNCTIONS = {
    "min": min,
    "max": max,
    "floor": math.floor,
    "ceil": math.ceil,
    "round": round,
}


@dataclass(frozen=True)
class FormulaExecutionContext:
    action_id: str | None = None
    step_id: str | None = None
    formula_id: str | None = None
    tags: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        object.__setattr__(self, "tags", tuple(normalize_formula_tags(self.tags)))

    @classmethod
    def for_formula(
        cls,
        formula: Formula,
        *,
        action_id: str | None = None,
        step_id: str | None = None,
        formula_id: str | None = None,
        semantic_tags: tuple[str, ...] = (),
    ) -> "FormulaExecutionContext":
        return cls(
            action_id=action_id,
            step_id=step_id,
            formula_id=formula_id,
            tags=tuple(formula.tags) + semantic_tags,
        )


EvaluationTimeEffect = EvaluationFormulaModifierEffect | RollModeModifierEffect


def _effect_matches_context(
    effect: EvaluationTimeEffect,
    context: FormulaExecutionContext,
) -> bool:
    return effect.selector.matches(
        tags=list(context.tags),
        action_id=context.action_id,
        formula_id=context.formula_id,
        step_id=context.step_id,
    )


def normalize_numeric_result(value: float | int) -> float | int:
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def apply_numeric_operation(
    current_value: float | int,
    modifier: float | int,
    operation: str,
) -> float | int:
    if operation == "add":
        return normalize_numeric_result(current_value + modifier)
    if operation == "subtract":
        return normalize_numeric_result(current_value - modifier)
    if operation == "multiply":
        return normalize_numeric_result(current_value * modifier)
    if operation == "divide":
        if modifier == 0:
            raise ValueError("Formula modifier divide operation cannot use zero.")
        return normalize_numeric_result(current_value / modifier)
    if operation == "set":
        return modifier
    raise ValueError(f"Unsupported formula modifier operation '{operation}'.")


def _compose_numeric_expression(
    expression: str,
    modifier: str,
    operation: str,
) -> str:
    if operation == "set":
        return f"({modifier})"
    operators = {
        "add": "+",
        "subtract": "-",
        "multiply": "*",
        "divide": "/",
    }
    operator = operators.get(operation)
    if operator is None:
        raise ValueError(f"Unsupported formula modifier operation '{operation}'.")
    return f"({expression}) {operator} ({modifier})"


def _roll_dice_expression(match: re.Match[str]) -> str:
    count = int(match.group("count") or "1")
    sides = int(match.group("sides"))
    keep_mode = match.group("keep")
    keep_count = int(match.group("keep_count") or "0")

    if count <= 0:
        raise ValueError("Dice count must be greater than 0.")
    if count > _MAX_DICE_COUNT:
        raise ValueError(f"Dice count must be at most {_MAX_DICE_COUNT}.")
    if sides <= 0:
        raise ValueError("Dice sides must be greater than 0.")
    if sides > _MAX_DICE_SIDES:
        raise ValueError(f"Dice sides must be at most {_MAX_DICE_SIDES}.")

    rolls = [random.randint(1, sides) for _ in range(count)]
    if keep_mode is None:
        kept_rolls = rolls
    else:
        if keep_count <= 0:
            raise ValueError("Dice keep count must be greater than 0.")
        if keep_count > count:
            raise ValueError("Dice keep count cannot exceed dice count.")
        kept_rolls = sorted(rolls, reverse=keep_mode.lower() == "kh")[:keep_count]

    return str(sum(kept_rolls))


def _resolve_dice_expressions(expression: str) -> str:
    return _DICE_PATTERN.sub(_roll_dice_expression, expression)


def _evaluate_math_node(node: ast.AST) -> float | int:
    if isinstance(node, ast.Expression):
        return _evaluate_math_node(node.body)
    if isinstance(node, ast.Constant) and isinstance(node.value, int | float):
        return node.value
    if isinstance(node, ast.BinOp):
        operator_type = type(node.op)
        operator = _ALLOWED_BINARY_OPERATORS.get(operator_type)
        if operator is None:
            raise ValueError(f"Unsupported formula operator: {operator_type.__name__}")
        return operator(
            _evaluate_math_node(node.left),
            _evaluate_math_node(node.right),
        )
    if isinstance(node, ast.UnaryOp):
        operator_type = type(node.op)
        operator = _ALLOWED_UNARY_OPERATORS.get(operator_type)
        if operator is None:
            raise ValueError(f"Unsupported formula operator: {operator_type.__name__}")
        return operator(_evaluate_math_node(node.operand))
    if isinstance(node, ast.Call):
        if not isinstance(node.func, ast.Name):
            raise ValueError("Unsupported formula function.")
        function_name = node.func.id
        function = _ALLOWED_FUNCTIONS.get(function_name)
        if function is None:
            raise ValueError(f"Unsupported formula function: {function_name}")
        if node.keywords:
            raise ValueError("Formula functions do not support keyword arguments.")
        args = [_evaluate_math_node(arg) for arg in node.args]
        if function_name in {"floor", "ceil"} and len(args) != 1:
            raise ValueError(f"{function_name}() requires exactly one argument.")
        if function_name == "round":
            if len(args) not in {1, 2}:
                raise ValueError("round() requires one or two arguments.")
            if len(args) == 2 and not isinstance(args[1], int):
                raise ValueError("round() digits argument must be a whole number.")
        if function_name in {"min", "max"} and not args:
            raise ValueError(f"{function_name}() requires at least one argument.")
        return function(*args)
    raise ValueError(f"Unsupported formula expression: {node.__class__.__name__}")


def evaluate_numeric_expression(expression: str) -> float | int:
    expression = _resolve_dice_expressions(expression)
    parsed = ast.parse(expression, mode="eval")
    return normalize_numeric_result(_evaluate_math_node(parsed))


def evaluate_numeric_formula(
    formula_root: Any,
    formula: Formula,
    *,
    execution_context: FormulaExecutionContext | None = None,
    modifiers: tuple[EvaluationTimeEffect, ...] = (),
) -> float | int:
    context = execution_context or FormulaExecutionContext.for_formula(formula)
    expanded_formula = formula.expand_formula(formula_root)
    result = evaluate_numeric_expression(expanded_formula)
    for effect in modifiers:
        if not isinstance(effect, EvaluationFormulaModifierEffect):
            continue
        if not _effect_matches_context(effect, context):
            continue
        modifier = evaluate_numeric_expression(effect.value.expand_formula(formula_root))
        result = apply_numeric_operation(result, modifier, effect.operation)
    return normalize_numeric_result(result)


def compose_roll20_message(
    formula_root: Any,
    formula: Formula,
    *,
    execution_context: FormulaExecutionContext,
    modifiers: tuple[EvaluationTimeEffect, ...] = (),
) -> str:
    message = formula.expand_formula(formula_root)
    numeric_modifiers = [
        effect
        for effect in modifiers
        if isinstance(effect, EvaluationFormulaModifierEffect)
        and _effect_matches_context(effect, execution_context)
    ]
    if not numeric_modifiers:
        return message

    match = _ROLL20_COMMAND_PATTERN.fullmatch(message)
    if match is None:
        return message

    expression = match.group("expression")
    for effect in numeric_modifiers:
        modifier = effect.value.expand_formula(formula_root)
        expression = _compose_numeric_expression(
            expression,
            modifier,
            effect.operation,
        )
    return f'{match.group("prefix")}{expression}'


def resolve_roll_mode(
    requested_mode: str,
    *,
    execution_context: FormulaExecutionContext,
    modifiers: tuple[EvaluationTimeEffect, ...] = (),
) -> str:
    modes = {requested_mode} if requested_mode != "normal" else set()
    modes.update(
        effect.roll_mode
        for effect in modifiers
        if isinstance(effect, RollModeModifierEffect)
        and _effect_matches_context(effect, execution_context)
    )
    if "advantage" in modes and "disadvantage" in modes:
        return "normal"
    if "advantage" in modes:
        return "advantage"
    if "disadvantage" in modes:
        return "disadvantage"
    return "normal"
