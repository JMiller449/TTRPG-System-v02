from __future__ import annotations

import ast
from dataclasses import dataclass
from math import isfinite
import re
from typing import Any, Literal


ATTRIBUTE_TOKEN = re.compile(r"@(?:\{([^{}]+)\}|([A-Za-z_][A-Za-z0-9_]*))")


def validate_expression(expression: str) -> None:
    """Validate deterministic arithmetic before calling the shared formula runtime."""
    if not isinstance(expression, str) or not expression.strip() or len(expression) > 1000:
        raise ValueError("XP equation must contain 1–1000 characters.")
    try:
        tree = ast.parse(ATTRIBUTE_TOKEN.sub("__attribute", expression), mode="eval")
    except SyntaxError as exc:
        raise ValueError("XP equation is not valid arithmetic.") from exc
    nodes = list(ast.walk(tree))
    if len(nodes) > 200:
        raise ValueError("XP equation is too complex.")
    allowed = (
        ast.Expression, ast.BinOp, ast.UnaryOp, ast.Constant, ast.Add,
        ast.Sub, ast.Mult, ast.Div, ast.FloorDiv, ast.Mod, ast.Pow,
        ast.UAdd, ast.USub, ast.Call, ast.Name, ast.Load,
    )
    for node in nodes:
        if (
            isinstance(node, ast.BinOp)
            and isinstance(node.op, ast.Pow)
            and any(isinstance(child, ast.Pow) for child in ast.walk(node.left))
        ):
            raise ValueError("Nested powers are not supported in XP equations.")
        if not isinstance(node, allowed):
            raise ValueError("XP equations support numeric arithmetic and min, max, floor, ceil, round only.")
        if isinstance(node, ast.Constant) and (
            isinstance(node.value, bool) or not isinstance(node.value, (int, float))
            or not isfinite(node.value) or abs(node.value) > 1e15
        ):
            raise ValueError("XP equation constants must be finite numbers up to 1e15.")
        if isinstance(node, ast.Name) and node.id not in {
            "min", "max", "floor", "ceil", "round", "__attribute",
        }:
            raise ValueError("Use @level or @{attribute_id} for numeric sheet Attributes; dice are not allowed.")
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Pow) and (
            not isinstance(node.right, ast.Constant)
            or not isinstance(node.right.value, (int, float))
            or not 0 <= node.right.value <= 16
        ):
            raise ValueError("XP equation powers require a constant exponent from 0 to 16.")


@dataclass
class XpProgression:
    mode: Literal["tuning", "formula"] = "tuning"
    base_xp: float = 100
    growth_exponent: float = 1.35
    milestone_interval: int = 25
    milestone_multiplier: float = 1.08
    growth_multiplier_per_milestone: float = 1
    rounding: int = 10
    expression: str = "100 * @level ** 2"

    def __post_init__(self) -> None:
        if self.mode not in {"tuning", "formula"}:
            raise ValueError("Unknown XP progression mode.")
        for name, low, high in (
            ("base_xp", 0, 1e12),
            ("growth_exponent", 0, 16),
            ("milestone_multiplier", 0, 1000),
        ):
            value = getattr(self, name)
            if (
                isinstance(value, bool)
                or not isinstance(value, (int, float))
                or not isfinite(value)
                or not low < value <= high
            ):
                raise ValueError(f"{name} must be finite, greater than {low}, and at most {high}.")
        increase = self.growth_multiplier_per_milestone
        if (
            isinstance(increase, bool)
            or not isinstance(increase, (int, float))
            or not isfinite(increase)
            or not 1 <= increase <= 1000
        ):
            raise ValueError("Growth multiplier per milestone must be finite and from 1 to 1000.")
        if self.milestone_multiplier < 1:
            raise ValueError("Milestone multiplier must be at least 1.")
        for name in ("milestone_interval", "rounding"):
            value = getattr(self, name)
            if (
                isinstance(value, bool)
                or not isinstance(value, int)
                or not 1 <= value <= 1_000_000
            ):
                raise ValueError(f"{name} must be a whole number from 1 to 1000000.")
        validate_expression(self.expression)

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> XpProgression:
        return cls(**raw)
