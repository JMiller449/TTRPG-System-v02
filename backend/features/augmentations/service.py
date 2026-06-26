from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from typing import Any, Literal

from backend.core.transport import PatchOp
from backend.features.formula_runtime.service import (
    evaluate_numeric_formula,
    normalize_numeric_result,
)
from backend.features.state_sync.service import state_sync_service
from backend.features.variable_registry.service import is_augmentation_target_allowed
from backend.state.models.augmentation import Augmentation, AugmentationSource
from backend.state.models.shared import Bridge
from backend.state.models.state import State


@dataclass
class AugmentationMutationResult:
    augmentation_id: str
    operation: Literal["applied", "removed", "ignored"]
    target_path: str | None = None
    value: int | float | None = None
    reason: str | None = None


@dataclass
class ConditionPresetHookResult:
    condition_id: str
    instance_id: str
    operation: Literal["applied", "removed", "ignored"]
    augmentation_results: list[AugmentationMutationResult]
    reason: str | None = None


@dataclass
class _ResolvedTarget:
    state_path: str
    root: Any
    target_id: str | None


def _evaluate_formula(root: Any, augmentation: Augmentation) -> float | int:
    return evaluate_numeric_formula(root, augmentation.effect.value)


def _target_label(augmentation: Augmentation) -> str:
    path = ".".join(augmentation.target.path)
    if not path:
        return augmentation.target.root
    return f"{augmentation.target.root}.{path}"


def _validate_runtime_augmentation_target(augmentation: Augmentation) -> None:
    if not augmentation.target.path:
        raise ValueError("Augmentation target path must not be empty.")

    if augmentation.target.root == "state":
        raise ValueError("Global state augmentation targets are not supported yet.")

    if not is_augmentation_target_allowed(
        root=augmentation.target.root,
        path=augmentation.target.path,
        context="runtime",
    ):
        raise ValueError(
            f"Runtime augmentation target '{_target_label(augmentation)}' is not allowed."
        )


def _resolve_target(
    state: State,
    augmentation: Augmentation,
    *,
    sheet_id: str | None = None,
    instance_id: str | None = None,
) -> _ResolvedTarget:
    _validate_runtime_augmentation_target(augmentation)

    if augmentation.target.root == "sheet":
        if augmentation.scope != "sheet":
            raise ValueError("Sheet augmentation targets must use sheet scope.")
        if sheet_id is None:
            sheet_id = augmentation.applied_target_id
        if sheet_id is None:
            raise ValueError("A sheet_id is required for sheet augmentation targets.")
        sheet = state.sheets.get(sheet_id)
        if sheet is None:
            raise ValueError(f"Sheet '{sheet_id}' does not exist.")
        return _ResolvedTarget(
            state_path=state_sync_service.join_path(
                "sheets", sheet_id, *augmentation.target.path
            ),
            root=sheet,
            target_id=sheet_id,
        )

    if augmentation.scope != "instance":
        raise ValueError("Instance augmentation targets must use instance scope.")
    if instance_id is None:
        instance_id = augmentation.applied_target_id
    if instance_id is None:
        raise ValueError("An instance_id is required for instance augmentation targets.")
    instance = state.instanced_sheets.get(instance_id)
    if instance is None:
        raise ValueError(f"Instanced sheet '{instance_id}' does not exist.")
    return _ResolvedTarget(
        state_path=state_sync_service.join_path(
            "instanced_sheets", instance_id, *augmentation.target.path
        ),
        root=instance,
        target_id=instance_id,
    )


def _current_numeric_value(state: State, state_path: str) -> int | float:
    container, leaf = state_sync_service._resolve_container(state, state_path)
    if isinstance(container, dict):
        if leaf not in container:
            raise ValueError(f"Augmentation target path {state_path} does not exist.")
        value = container[leaf]
    elif isinstance(container, list):
        index = state_sync_service._list_index(leaf)
        try:
            value = container[index]
        except IndexError as exc:
            raise ValueError(
                f"Augmentation target path {state_path} does not exist."
            ) from exc
    else:
        if not hasattr(container, leaf):
            raise ValueError(f"Augmentation target path {state_path} does not exist.")
        value = getattr(container, leaf)

    if not isinstance(value, int | float):
        raise ValueError(f"Augmentation target path {state_path} is not numeric.")
    return value


def _apply_operation(
    current_value: int | float,
    modifier: int | float,
    operation: str,
) -> int | float:
    if operation == "add":
        return normalize_numeric_result(current_value + modifier)
    if operation == "subtract":
        return normalize_numeric_result(current_value - modifier)
    if operation == "multiply":
        return normalize_numeric_result(current_value * modifier)
    if operation == "divide":
        if modifier == 0:
            raise ValueError("Augmentation divide operation cannot use zero.")
        return normalize_numeric_result(current_value / modifier)
    if operation == "set":
        return modifier
    raise ValueError(f"Unsupported augmentation operation '{operation}'.")


def _remove_operation(
    current_value: int | float,
    modifier: int | float,
    operation: str,
) -> int | float:
    if operation == "add":
        return normalize_numeric_result(current_value - modifier)
    if operation == "subtract":
        return normalize_numeric_result(current_value + modifier)
    if operation == "multiply":
        if modifier == 0:
            raise ValueError("Cannot remove a multiply-by-zero augmentation.")
        return normalize_numeric_result(current_value / modifier)
    if operation == "divide":
        return normalize_numeric_result(current_value * modifier)
    if operation == "set":
        raise ValueError("Set augmentations cannot be removed without stored base state.")
    raise ValueError(f"Unsupported augmentation operation '{operation}'.")


def _set_application_state_ops(
    state: State,
    augmentation_id: str,
    *,
    applied: bool,
    applied_target_id: str | None,
) -> list[PatchOp]:
    return [
        state_sync_service.set_mutation(
            state,
            state_sync_service.join_path("augmentations", augmentation_id, "applied"),
            applied,
        ),
        state_sync_service.set_mutation(
            state,
            state_sync_service.join_path(
                "augmentations", augmentation_id, "applied_target_id"
            ),
            applied_target_id,
        ),
    ]


def _apply_augmentation_mutation(
    state: State,
    augmentation_id: str,
    *,
    sheet_id: str | None = None,
    instance_id: str | None = None,
) -> tuple[AugmentationMutationResult, list[PatchOp]]:
    augmentation = state.augmentations.get(augmentation_id)
    if augmentation is None:
        raise ValueError(f"Augmentation '{augmentation_id}' does not exist.")

    if not augmentation.active:
        return (
            AugmentationMutationResult(
                augmentation_id=augmentation_id,
                operation="ignored",
                reason="inactive",
            ),
            [],
        )

    if augmentation.applied:
        return (
            AugmentationMutationResult(
                augmentation_id=augmentation_id,
                operation="ignored",
                reason="already_applied",
            ),
            [],
        )

    target = _resolve_target(
        state,
        augmentation,
        sheet_id=sheet_id,
        instance_id=instance_id,
    )
    current_value = _current_numeric_value(state, target.state_path)
    modifier = _evaluate_formula(target.root, augmentation)
    next_value = _apply_operation(
        current_value,
        modifier,
        augmentation.effect.operation,
    )

    ops = [
        state_sync_service.set_mutation(state, target.state_path, next_value),
        *_set_application_state_ops(
            state,
            augmentation_id,
            applied=True,
            applied_target_id=target.target_id,
        ),
    ]
    return (
        AugmentationMutationResult(
            augmentation_id=augmentation_id,
            operation="applied",
            target_path=target.state_path,
            value=next_value,
        ),
        ops,
    )


def apply_augmentation_mutation(
    state: State,
    augmentation_id: str,
    *,
    sheet_id: str | None = None,
    instance_id: str | None = None,
) -> tuple[AugmentationMutationResult, list[PatchOp]]:
    return _apply_augmentation_mutation(
        state,
        augmentation_id,
        sheet_id=sheet_id,
        instance_id=instance_id,
    )


def _remove_augmentation_mutation(
    state: State,
    augmentation_id: str,
    *,
    sheet_id: str | None = None,
    instance_id: str | None = None,
) -> tuple[AugmentationMutationResult, list[PatchOp]]:
    augmentation = state.augmentations.get(augmentation_id)
    if augmentation is None:
        raise ValueError(f"Augmentation '{augmentation_id}' does not exist.")

    if not augmentation.applied:
        return (
            AugmentationMutationResult(
                augmentation_id=augmentation_id,
                operation="ignored",
                reason="not_applied",
            ),
            [],
        )

    target = _resolve_target(
        state,
        augmentation,
        sheet_id=sheet_id,
        instance_id=instance_id,
    )
    if augmentation.applied_target_id != target.target_id:
        raise ValueError(
            f"Augmentation '{augmentation_id}' is applied to "
            f"'{augmentation.applied_target_id}', not '{target.target_id}'."
        )

    current_value = _current_numeric_value(state, target.state_path)
    modifier = _evaluate_formula(target.root, augmentation)
    next_value = _remove_operation(
        current_value,
        modifier,
        augmentation.effect.operation,
    )

    ops = [
        state_sync_service.set_mutation(state, target.state_path, next_value),
        *_set_application_state_ops(
            state,
            augmentation_id,
            applied=False,
            applied_target_id=None,
        ),
    ]
    return (
        AugmentationMutationResult(
            augmentation_id=augmentation_id,
            operation="removed",
            target_path=target.state_path,
            value=next_value,
        ),
        ops,
    )


def remove_augmentation_mutation(
    state: State,
    augmentation_id: str,
    *,
    sheet_id: str | None = None,
    instance_id: str | None = None,
) -> tuple[AugmentationMutationResult, list[PatchOp]]:
    return _remove_augmentation_mutation(
        state,
        augmentation_id,
        sheet_id=sheet_id,
        instance_id=instance_id,
    )


async def apply_augmentation(
    augmentation_id: str,
    *,
    sheet_id: str | None = None,
    instance_id: str | None = None,
    request_id: str | None = None,
) -> AugmentationMutationResult:
    def mutation(state: State) -> tuple[AugmentationMutationResult, list[PatchOp]]:
        return _apply_augmentation_mutation(
            state,
            augmentation_id,
            sheet_id=sheet_id,
            instance_id=instance_id,
        )

    return await state_sync_service.apply_mutation(mutation, request_id=request_id)


async def remove_augmentation(
    augmentation_id: str,
    *,
    sheet_id: str | None = None,
    instance_id: str | None = None,
    request_id: str | None = None,
) -> AugmentationMutationResult:
    def mutation(state: State) -> tuple[AugmentationMutationResult, list[PatchOp]]:
        return _remove_augmentation_mutation(
            state,
            augmentation_id,
            sheet_id=sheet_id,
            instance_id=instance_id,
        )

    return await state_sync_service.apply_mutation(mutation, request_id=request_id)


def _condition_augmentation_id(
    condition_id: str,
    instance_id: str,
    template_id: str,
) -> str:
    return f"condition:{condition_id}:{instance_id}:{template_id}"


def _build_condition_augmentation(
    template: Augmentation,
    *,
    condition_id: str,
    condition_name: str,
    instance_id: str,
) -> Augmentation:
    if template.scope != "instance" or template.target.root != "instance":
        raise ValueError(
            "Condition preset augmentation templates must target the current instance."
        )

    augmentation = deepcopy(template)
    augmentation.id = _condition_augmentation_id(
        condition_id,
        instance_id,
        template.id,
    )
    augmentation.source = AugmentationSource(
        type="condition",
        id=condition_id,
        label=condition_name,
    )
    augmentation.applied = False
    augmentation.applied_target_id = None
    return augmentation


def _condition_bridge(augmentation_id: str) -> Bridge:
    return Bridge(
        relationship_id=augmentation_id,
        entry_id=augmentation_id,
    )


def _apply_condition_preset_mutation(
    state: State,
    *,
    instance_id: str,
    condition_id: str,
) -> tuple[ConditionPresetHookResult, list[PatchOp]]:
    instance = state.instanced_sheets.get(instance_id)
    if instance is None:
        raise ValueError(f"Instanced sheet '{instance_id}' does not exist.")

    condition = state.condition_presets.get(condition_id)
    if condition is None:
        raise ValueError(f"Condition preset '{condition_id}' does not exist.")

    if not condition.augmentation_templates:
        return (
            ConditionPresetHookResult(
                condition_id=condition_id,
                instance_id=instance_id,
                operation="ignored",
                augmentation_results=[],
                reason="no_augmentation_templates",
            ),
            [],
        )

    results: list[AugmentationMutationResult] = []
    ops: list[PatchOp] = []

    for template in condition.augmentation_templates:
        augmentation = _build_condition_augmentation(
            template,
            condition_id=condition.id,
            condition_name=condition.name,
            instance_id=instance_id,
        )

        if augmentation.id in state.augmentations:
            results.append(
                AugmentationMutationResult(
                    augmentation_id=augmentation.id,
                    operation="ignored",
                    reason="already_applied",
                )
            )
            continue

        add_augmentation_op = state_sync_service.add_mutation(
            state,
            state_sync_service.join_path("augmentations", augmentation.id),
            augmentation,
        )
        add_bridge_op = state_sync_service.add_mutation(
            state,
            state_sync_service.join_path(
                "instanced_sheets",
                instance_id,
                "augments",
                augmentation.id,
            ),
            _condition_bridge(augmentation.id),
        )
        result, apply_ops = _apply_augmentation_mutation(
            state,
            augmentation.id,
            instance_id=instance_id,
        )

        results.append(result)
        ops.extend([add_augmentation_op, add_bridge_op, *apply_ops])

    operation: Literal["applied", "ignored"] = (
        "applied"
        if any(result.operation == "applied" for result in results)
        else "ignored"
    )
    reason = None if operation == "applied" else "already_applied"
    return (
        ConditionPresetHookResult(
            condition_id=condition_id,
            instance_id=instance_id,
            operation=operation,
            augmentation_results=results,
            reason=reason,
        ),
        ops,
    )


def apply_condition_preset_mutation(
    state: State,
    *,
    instance_id: str,
    condition_id: str,
) -> tuple[ConditionPresetHookResult, list[PatchOp]]:
    return _apply_condition_preset_mutation(
        state,
        instance_id=instance_id,
        condition_id=condition_id,
    )


def _condition_augmentation_ids_for_instance(
    state: State,
    *,
    instance_id: str,
    condition_id: str,
) -> list[str]:
    return [
        augmentation_id
        for augmentation_id, augmentation in state.augmentations.items()
        if augmentation.source.type == "condition"
        and augmentation.source.id == condition_id
        and augmentation.applied_target_id == instance_id
    ]


def _remove_condition_preset_mutation(
    state: State,
    *,
    instance_id: str,
    condition_id: str,
) -> tuple[ConditionPresetHookResult, list[PatchOp]]:
    if instance_id not in state.instanced_sheets:
        raise ValueError(f"Instanced sheet '{instance_id}' does not exist.")

    if condition_id not in state.condition_presets:
        raise ValueError(f"Condition preset '{condition_id}' does not exist.")

    augmentation_ids = _condition_augmentation_ids_for_instance(
        state,
        instance_id=instance_id,
        condition_id=condition_id,
    )
    if not augmentation_ids:
        return (
            ConditionPresetHookResult(
                condition_id=condition_id,
                instance_id=instance_id,
                operation="ignored",
                augmentation_results=[],
                reason="not_applied",
            ),
            [],
        )

    results: list[AugmentationMutationResult] = []
    ops: list[PatchOp] = []

    for augmentation_id in augmentation_ids:
        result, remove_ops = _remove_augmentation_mutation(
            state,
            augmentation_id,
            instance_id=instance_id,
        )
        results.append(result)
        ops.extend(remove_ops)

        bridge_path = state_sync_service.join_path(
            "instanced_sheets",
            instance_id,
            "augments",
            augmentation_id,
        )
        if augmentation_id in state.instanced_sheets[instance_id].augments:
            _, remove_bridge_op = state_sync_service.remove_mutation(state, bridge_path)
            ops.append(remove_bridge_op)

        _, remove_augmentation_op = state_sync_service.remove_mutation(
            state,
            state_sync_service.join_path("augmentations", augmentation_id),
        )
        ops.append(remove_augmentation_op)

    return (
        ConditionPresetHookResult(
            condition_id=condition_id,
            instance_id=instance_id,
            operation="removed",
            augmentation_results=results,
        ),
        ops,
    )


def remove_condition_preset_mutation(
    state: State,
    *,
    instance_id: str,
    condition_id: str,
) -> tuple[ConditionPresetHookResult, list[PatchOp]]:
    return _remove_condition_preset_mutation(
        state,
        instance_id=instance_id,
        condition_id=condition_id,
    )


async def apply_condition_preset(
    *,
    instance_id: str,
    condition_id: str,
    request_id: str | None = None,
) -> ConditionPresetHookResult:
    def mutation(state: State) -> tuple[ConditionPresetHookResult, list[PatchOp]]:
        return _apply_condition_preset_mutation(
            state,
            instance_id=instance_id,
            condition_id=condition_id,
        )

    return await state_sync_service.apply_mutation(mutation, request_id=request_id)


async def remove_condition_preset(
    *,
    instance_id: str,
    condition_id: str,
    request_id: str | None = None,
) -> ConditionPresetHookResult:
    def mutation(state: State) -> tuple[ConditionPresetHookResult, list[PatchOp]]:
        return _remove_condition_preset_mutation(
            state,
            instance_id=instance_id,
            condition_id=condition_id,
        )

    return await state_sync_service.apply_mutation(mutation, request_id=request_id)


async def recompute_augmentations(
    *,
    sheet_id: str | None = None,
    instance_id: str | None = None,
    request_id: str | None = None,
) -> list[AugmentationMutationResult]:
    def mutation(state: State) -> tuple[list[AugmentationMutationResult], list[PatchOp]]:
        results: list[AugmentationMutationResult] = []
        ops: list[PatchOp] = []
        recompute_targets: list[tuple[str, str | None]] = []

        for augmentation_id in list(state.augmentations):
            augmentation = state.augmentations[augmentation_id]
            target_id = sheet_id if augmentation.target.root == "sheet" else instance_id
            if augmentation.target.root == "sheet" and target_id is None:
                target_id = augmentation.applied_target_id
            if augmentation.target.root == "instance" and target_id is None:
                target_id = augmentation.applied_target_id
            if augmentation.target.root != "state" and target_id is None:
                continue

            if (augmentation.active and not augmentation.applied) or (
                not augmentation.active and augmentation.applied
            ):
                _validate_runtime_augmentation_target(augmentation)

            recompute_targets.append((augmentation_id, target_id))

        for augmentation_id, target_id in recompute_targets:
            augmentation = state.augmentations[augmentation_id]
            if augmentation.active and not augmentation.applied:
                result, result_ops = _apply_augmentation_mutation(
                    state,
                    augmentation_id,
                    sheet_id=target_id if augmentation.target.root == "sheet" else None,
                    instance_id=target_id
                    if augmentation.target.root == "instance"
                    else None,
                )
            elif not augmentation.active and augmentation.applied:
                result, result_ops = _remove_augmentation_mutation(
                    state,
                    augmentation_id,
                    sheet_id=target_id if augmentation.target.root == "sheet" else None,
                    instance_id=target_id
                    if augmentation.target.root == "instance"
                    else None,
                )
            else:
                result = AugmentationMutationResult(
                    augmentation_id=augmentation_id,
                    operation="ignored",
                    reason="already_in_sync",
                )
                result_ops = []

            results.append(result)
            ops.extend(result_ops)

        return results, ops

    return await state_sync_service.apply_mutation(mutation, request_id=request_id)
