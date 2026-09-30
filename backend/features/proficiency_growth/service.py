from __future__ import annotations

from math import isfinite

from backend.features.augmentations import service as augmentation_service
from backend.features.formula_runtime.service import (
    apply_numeric_operation,
    evaluate_numeric_formula,
)
from backend.state.models.proficiency import ProficiencyBridge
from backend.state.models.state import State


def effective_growth_rate(
    state: State,
    *,
    sheet_id: str,
    instance_id: str | None,
    bridge: ProficiencyBridge,
) -> float:
    definition = state.proficiencies.get(bridge.prof_id)
    if definition is None:
        raise ValueError(f"Proficiency '{bridge.prof_id}' does not exist.")
    root = (
        state.instanced_sheets.get(instance_id)
        if instance_id is not None
        else state.sheets.get(sheet_id)
    )
    if root is None:
        raise ValueError("Proficiency growth target does not exist.")

    rate: float | int = bridge.growth_rate
    for effect in augmentation_service.matching_proficiency_growth_effects(
        state,
        sheet_id=sheet_id,
        instance_id=instance_id,
        tags=definition.tags,
    ):
        modifier = evaluate_numeric_formula(root, effect.value)
        rate = apply_numeric_operation(rate, modifier, effect.operation)

    if isinstance(rate, bool) or not isinstance(rate, int | float) or not isfinite(rate):
        raise ValueError("Effective proficiency growth rate must be finite.")
    if rate < 0:
        raise ValueError("Effective proficiency growth rate must not be negative.")
    return float(rate)


def growth_points_after_uses(
    state: State,
    *,
    sheet_id: str,
    instance_id: str | None,
    bridge: ProficiencyBridge,
    quantity: int,
) -> float:
    if quantity <= 0:
        raise ValueError("Proficiency use quantity must be positive.")
    rate = effective_growth_rate(
        state,
        sheet_id=sheet_id,
        instance_id=instance_id,
        bridge=bridge,
    )
    return min(1.0, round(bridge.progress + (rate * quantity), 12))
