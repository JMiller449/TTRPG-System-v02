from __future__ import annotations

import ast
from typing import Any

from backend.state.models.formula import Formula

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


def normalize_numeric_result(value: float | int) -> float | int:
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


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
    raise ValueError(f"Unsupported formula expression: {node.__class__.__name__}")


def evaluate_numeric_expression(expression: str) -> float | int:
    parsed = ast.parse(expression, mode="eval")
    return normalize_numeric_result(_evaluate_math_node(parsed))


def evaluate_numeric_formula(formula_root: Any, formula: Formula) -> float | int:
    expanded_formula = formula.expand_formula(formula_root)
    return evaluate_numeric_expression(expanded_formula)
