from __future__ import annotations

from copy import deepcopy
from dataclasses import asdict, is_dataclass

from backend.features.sheet_admin.actions.schema import (
    ActionDefinitionPayload,
    ActionStepPayload,
    ApplyAugmentationActionStepPayload,
    ApplyConditionPresetActionStepPayload,
    CreateAction,
    DeleteAction,
    DecrementValueActionStepPayload,
    GainProficiencyUseActionStepPayload,
    IncrementValueActionStepPayload,
    NumericBoundsPayload,
    ResolveDamageActionStepPayload,
    SendMessageActionStepPayload,
    SetValueActionStepPayload,
    UpdateAction,
)
from backend.features.sheet_admin.formulas.service import (
    build_formula,
    validate_formula_payload_paths,
)
from backend.features.sheet_admin.shared.schema import (
    CreateEntity,
    DeleteEntity,
    UpdateEntity,
)
from backend.features.state_sync.service import state_sync_service
from backend.features.variable_registry import service as variable_registry_service
from backend.state.models.action import (
    Action,
    ApplyAugmentationStep,
    ApplyConditionPresetStep,
    DecrementValueStep,
    GainProficiencyUseStep,
    IncrementValueStep,
    ResolveDamageStep,
    SendMessageStep,
    SetValueStep,
)
from backend.state.models.state import State


def _format_path(path: list[str]) -> str:
    return ".".join(path)


def _valid_action_mutation_paths() -> set[tuple[str, ...]]:
    registry = variable_registry_service.build_action_formula_authoring_metadata()
    return {
        tuple(variable.path)
        for variable in registry.variables
        if variable.action_mutation_allowed
    }


def _validate_action_step_target(step: ActionStepPayload) -> None:
    target = getattr(step, "target", "caster")
    if target != "caster":
        raise ValueError(
            "Action step target 'target' is not supported for MVP; use 'caster'."
        )


def _validate_action_mutation_path(path: list[str]) -> None:
    if tuple(path) not in _valid_action_mutation_paths():
        raise ValueError(
            f"Action mutation path '{_format_path(path)}' is not supported."
        )


def _validate_action_step(step: ActionStepPayload, state: State | None = None) -> None:
    _validate_action_step_target(step)
    if isinstance(step, SendMessageActionStepPayload):
        validate_formula_payload_paths(step.message)
        return
    if isinstance(step, SetValueActionStepPayload):
        _validate_action_mutation_path(step.path)
        validate_formula_payload_paths(step.value)
    if isinstance(
        step,
        (IncrementValueActionStepPayload, DecrementValueActionStepPayload),
    ):
        _validate_action_mutation_path(step.path)
        validate_formula_payload_paths(step.amount)
    if isinstance(step, GainProficiencyUseActionStepPayload):
        if state is not None and step.proficiency_id not in state.proficiencies:
            raise ValueError(f"Proficiency '{step.proficiency_id}' does not exist.")
        validate_formula_payload_paths(step.amount)
    if isinstance(step, ResolveDamageActionStepPayload):
        validate_formula_payload_paths(step.amount)
    if isinstance(step, NumericBoundsPayload):
        if step.min_value is not None:
            validate_formula_payload_paths(step.min_value)
        if step.max_value is not None:
            validate_formula_payload_paths(step.max_value)


def _validate_action_payload(
    payload: ActionDefinitionPayload,
    state: State | None = None,
) -> None:
    for step in payload.steps:
        _validate_action_step(step, state)


def _bounds_kwargs(step: NumericBoundsPayload) -> dict:
    return {
        "min_value": build_formula(step.min_value)
        if step.min_value is not None
        else None,
        "max_value": build_formula(step.max_value)
        if step.max_value is not None
        else None,
        "on_min_violation": step.on_min_violation,
        "on_max_violation": step.on_max_violation,
    }


def _build_step(
    step: (
        SendMessageActionStepPayload
        | SetValueActionStepPayload
        | IncrementValueActionStepPayload
        | DecrementValueActionStepPayload
        | ResolveDamageActionStepPayload
        | GainProficiencyUseActionStepPayload
        | ApplyAugmentationActionStepPayload
        | ApplyConditionPresetActionStepPayload
    ),
):
    if isinstance(step, SendMessageActionStepPayload):
        return SendMessageStep(
            step_id=step.step_id,
            message=build_formula(step.message),
        )
    if isinstance(step, SetValueActionStepPayload):
        return SetValueStep(
            step_id=step.step_id,
            target=step.target,
            path=list(step.path),
            value=build_formula(step.value),
            **_bounds_kwargs(step),
        )
    if isinstance(step, IncrementValueActionStepPayload):
        return IncrementValueStep(
            step_id=step.step_id,
            target=step.target,
            path=list(step.path),
            amount=build_formula(step.amount),
            **_bounds_kwargs(step),
        )
    if isinstance(step, DecrementValueActionStepPayload):
        return DecrementValueStep(
            step_id=step.step_id,
            target=step.target,
            path=list(step.path),
            amount=build_formula(step.amount),
            **_bounds_kwargs(step),
        )
    if isinstance(step, ResolveDamageActionStepPayload):
        return ResolveDamageStep(
            step_id=step.step_id,
            target=step.target,
            damage_type=step.damage_type,
            amount=build_formula(step.amount),
        )
    if isinstance(step, ApplyAugmentationActionStepPayload):
        return ApplyAugmentationStep(
            step_id=step.step_id,
            target=step.target,
            augmentation_id=step.augmentation_id,
            operation=step.operation,
        )
    if isinstance(step, ApplyConditionPresetActionStepPayload):
        return ApplyConditionPresetStep(
            step_id=step.step_id,
            target=step.target,
            condition_id=step.condition_id,
            operation=step.operation,
        )
    return GainProficiencyUseStep(
        step_id=step.step_id,
        target=step.target,
        proficiency_id=step.proficiency_id,
        amount=build_formula(step.amount),
    )


def _build_action(payload: ActionDefinitionPayload, state: State | None = None) -> Action:
    _validate_action_payload(payload, state)
    return Action(
        id=payload.id,
        name=payload.name,
        notes=payload.notes,
        steps=[_build_step(step) for step in payload.steps],
    )


def _actions_state(state: State) -> dict[str, dict]:
    return state.actions


def _merge_entity(current: dict, partial: dict) -> dict:
    merged = deepcopy(current)
    for key, value in partial.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _merge_entity(merged[key], value)
            continue
        merged[key] = value
    return merged


async def handle_request(request: CreateEntity | UpdateEntity | DeleteEntity) -> None:
    if isinstance(request, CreateEntity):
        await create_action(request)
        return
    if isinstance(request, UpdateEntity):
        await update_action(request)
        return
    await delete_action(request)


async def _create_action(
    payload: ActionDefinitionPayload,
    *,
    request_id: str | None = None,
) -> None:
    def mutation(state: State) -> tuple[None, list]:
        actions = _actions_state(state)
        if payload.id in actions:
            raise ValueError(f"Action '{payload.id}' already exists.")
        action = _build_action(payload, state)
        path = state_sync_service.join_path("actions", payload.id)
        op = state_sync_service.add_mutation(state, path, action)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request_id)


async def _update_action(
    action_id: str,
    payload: ActionDefinitionPayload,
    *,
    request_id: str | None = None,
) -> None:
    if payload.id != action_id:
        raise ValueError("Action ID cannot be changed.")

    def mutation(state: State) -> tuple[None, list]:
        actions = _actions_state(state)
        if action_id not in actions:
            raise ValueError(f"Action '{action_id}' does not exist.")

        action = _build_action(payload, state)
        path = state_sync_service.join_path("actions", action_id)
        op = state_sync_service.set_mutation(state, path, action)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request_id)


async def _delete_action(
    action_id: str,
    *,
    request_id: str | None = None,
) -> None:
    def mutation(state: State) -> tuple[None, list]:
        actions = _actions_state(state)
        if action_id not in actions:
            raise ValueError(f"Action '{action_id}' does not exist.")

        path = state_sync_service.join_path("actions", action_id)
        _, op = state_sync_service.remove_mutation(state, path)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request_id)


async def create_action(request: CreateEntity) -> None:
    payload = ActionDefinitionPayload.model_validate(request.entity)
    await _create_action(payload, request_id=request.request_id)


async def update_action(request: UpdateEntity) -> None:
    def mutation(state: State) -> tuple[ActionDefinitionPayload, list]:
        actions = _actions_state(state)
        current = actions.get(request.entity_id)
        if current is None:
            raise ValueError(f"Action '{request.entity_id}' does not exist.")

        merged = _merge_entity(
            asdict(current) if is_dataclass(current) else current,
            request.entity_partial,
        )
        payload = ActionDefinitionPayload.model_validate(merged)
        if payload.id != request.entity_id:
            raise ValueError("Action ID cannot be changed.")
        return payload, []

    payload = await state_sync_service.apply_mutation(
        mutation,
        request_id=request.request_id,
    )
    await _update_action(
        request.entity_id,
        payload,
        request_id=request.request_id,
    )


async def delete_action(request: DeleteEntity) -> None:
    await _delete_action(request.entity_id, request_id=request.request_id)


async def create_typed_action(request: CreateAction) -> None:
    await _create_action(request.action, request_id=request.request_id)


async def update_typed_action(request: UpdateAction) -> None:
    await _update_action(
        request.action_id,
        request.action,
        request_id=request.request_id,
    )


async def delete_typed_action(request: DeleteAction) -> None:
    await _delete_action(request.action_id, request_id=request.request_id)
