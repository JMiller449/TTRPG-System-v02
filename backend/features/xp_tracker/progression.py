from __future__ import annotations

from math import floor, isfinite

from backend.features.formula_runtime.service import evaluate_numeric_expression
from backend.state.models.xp_progression import ATTRIBUTE_TOKEN, XpProgression
from backend.state.models.state import State


def tuning_level_cost(config: XpProgression, level: int, growth: float) -> float:
    """Cost of level → level + 1; only the destination can trigger a bump."""
    exponent = (
        config.growth_exponent
        + (level // config.milestone_interval) * config.growth_increase_per_milestone
    )
    bump = config.milestone_multiplier if (level + 1) % config.milestone_interval == 0 else 1
    raw = config.base_xp * float(level) ** exponent * bump * growth
    if not isfinite(raw) or raw <= 0 or raw > 1e15:
        raise ValueError("XP cost must be positive and at most 1e15.")
    return float(max(config.rounding, floor(raw / config.rounding) * config.rounding))


def xp_goal(
    state: State, instance_id: str, config: XpProgression | None = None
) -> float:
    """Lifetime XP target for advancing from the current manually assigned Level."""
    config = config or state.xp_progression
    instance = state.instanced_sheets[instance_id]

    def attribute(attribute_id: str) -> float:
        definition = state.attributes.get(attribute_id)
        bridge = instance.attributes.get(attribute_id)
        if (
            definition is None
            or definition.value_type != "number"
            or "sheet" not in definition.subject_types
            or bridge is None
            or bridge.evaluation_error
        ):
            raise ValueError("XP equation requires a valid numeric sheet Attribute.")
        value = bridge.evaluated_value
        if (
            isinstance(value, bool)
            or not isinstance(value, (int, float))
            or not isfinite(value)
        ):
            raise ValueError("XP equation requires a finite numeric sheet Attribute.")
        return float(value)

    level = attribute("level")
    growth = attribute("xp_growth_rate")
    if level < 1 or int(level) != level or growth <= 0:
        raise ValueError("XP requires a positive whole Level and positive Growth Rate.")
    if config.mode == "formula":
        expression = ATTRIBUTE_TOKEN.sub(
            lambda match: f"({attribute(match.group(1) or match.group(2))})",
            config.expression,
        )
        base = evaluate_numeric_expression(expression)
        rounding = 1
    else:
        if level > 100_000:
            raise ValueError("Tuning supports levels up to 100000.")
        total = 0.0
        for step in range(1, int(level) + 1):
            total += tuning_level_cost(config, step, growth)
            if total > 1e15:
                raise ValueError("XP goal must be at most 1e15.")
        return total
    result = base * growth
    if not isfinite(result) or result <= 0 or result > 1e15:
        raise ValueError("XP goal must be positive and at most 1e15.")
    return float(max(rounding, floor(result / rounding) * rounding))
