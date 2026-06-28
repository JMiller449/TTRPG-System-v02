from __future__ import annotations

from copy import deepcopy
from dataclasses import asdict, is_dataclass

from backend.features.sheet_admin.actions.schema import (
    ActionDefinitionPayload,
    ActionStepPayload,
    ApplyAugmentationActionStepPayload,
    ApplyConditionPresetActionStepPayload,
    CalculateValueActionStepPayload,
    CalculatedValueReferencePayload,
    CreateAction,
    DeleteAction,
    DecrementValueActionStepPayload,
    GainProficiencyUseActionStepPayload,
    IncrementValueActionStepPayload,
    NumericBoundsPayload,
    NumericValuePayload,
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
    ActionStep,
    ApplyAugmentationStep,
    ApplyConditionPresetStep,
    CalculateValueStep,
    CalculatedValueReference,
    DecrementValueStep,
    GainProficiencyUseStep,
    IncrementValueStep,
    NumericValueSource,
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


def _action_value_paths(variable_ids: set[str]) -> set[tuple[str, ...]]:
    return {("action_values", variable_id) for variable_id in variable_ids}


def _validate_numeric_value(
    value: NumericValuePayload | None,
    *,
    available_variables: set[str],
) -> None:
    if value is None or isinstance(value, CalculatedValueReferencePayload):
        return
    validate_formula_payload_paths(
        value,
        additional_paths=_action_value_paths(available_variables),
    )


def _validate_action_step(
    step: ActionStepPayload,
    state: State | None = None,
    *,
    available_variables: set[str],
) -> None:
    _validate_action_step_target(step)
    if isinstance(step, SendMessageActionStepPayload):
        validate_formula_payload_paths(
            step.message,
            additional_paths=_action_value_paths(available_variables),
        )
        return
    if isinstance(step, CalculateValueActionStepPayload):
        validate_formula_payload_paths(
            step.value,
            additional_paths=_action_value_paths(available_variables),
        )
        return
    if isinstance(step, SetValueActionStepPayload):
        _validate_action_mutation_path(step.path)
        _validate_numeric_value(
            step.value,
            available_variables=available_variables,
        )
    if isinstance(
        step,
        (IncrementValueActionStepPayload, DecrementValueActionStepPayload),
    ):
        _validate_action_mutation_path(step.path)
        _validate_numeric_value(
            step.amount,
            available_variables=available_variables,
        )
    if isinstance(step, GainProficiencyUseActionStepPayload):
        if state is not None and step.proficiency_id not in state.proficiencies:
            raise ValueError(f"Proficiency '{step.proficiency_id}' does not exist.")
        _validate_numeric_value(
            step.amount,
            available_variables=available_variables,
        )
    if isinstance(step, ResolveDamageActionStepPayload):
        _validate_numeric_value(
            step.amount,
            available_variables=available_variables,
        )
    if isinstance(step, NumericBoundsPayload):
        _validate_numeric_value(
            step.min_value,
            available_variables=available_variables,
        )
        _validate_numeric_value(
            step.max_value,
            available_variables=available_variables,
        )


def _validate_action_payload(
    payload: ActionDefinitionPayload,
    state: State | None = None,
) -> None:
    available_variables: set[str] = set()
    for step in payload.steps:
        _validate_action_step(
            step,
            state,
            available_variables=available_variables,
        )
        if isinstance(step, CalculateValueActionStepPayload):
            available_variables.add(step.variable_id)


def _build_numeric_value(
    value: NumericValuePayload,
    *,
    available_variables: set[str],
) -> NumericValueSource:
    if isinstance(value, CalculatedValueReferencePayload):
        return CalculatedValueReference(variable_id=value.variable_id)
    return build_formula(
        value,
        additional_paths=_action_value_paths(available_variables),
    )


def _bounds_kwargs(
    step: NumericBoundsPayload,
    *,
    available_variables: set[str],
) -> dict:
    return {
        "min_value": _build_numeric_value(
            step.min_value,
            available_variables=available_variables,
        )
        if step.min_value is not None
        else None,
        "max_value": _build_numeric_value(
            step.max_value,
            available_variables=available_variables,
        )
        if step.max_value is not None
        else None,
        "on_min_violation": step.on_min_violation,
        "on_max_violation": step.on_max_violation,
    }


def _build_step(
    step: (
        SendMessageActionStepPayload
        | CalculateValueActionStepPayload
        | SetValueActionStepPayload
        | IncrementValueActionStepPayload
        | DecrementValueActionStepPayload
        | ResolveDamageActionStepPayload
        | GainProficiencyUseActionStepPayload
        | ApplyAugmentationActionStepPayload
        | ApplyConditionPresetActionStepPayload
    ),
    *,
    available_variables: set[str],
) -> ActionStep:
    if isinstance(step, SendMessageActionStepPayload):
        return SendMessageStep(
            step_id=step.step_id,
            message=build_formula(
                step.message,
                additional_paths=_action_value_paths(available_variables),
            ),
        )
    if isinstance(step, CalculateValueActionStepPayload):
        return CalculateValueStep(
            step_id=step.step_id,
            variable_id=step.variable_id,
            value=build_formula(
                step.value,
                additional_paths=_action_value_paths(available_variables),
            ),
        )
    if isinstance(step, SetValueActionStepPayload):
        return SetValueStep(
            step_id=step.step_id,
            target=step.target,
            path=list(step.path),
            value=_build_numeric_value(
                step.value,
                available_variables=available_variables,
            ),
            **_bounds_kwargs(step, available_variables=available_variables),
        )
    if isinstance(step, IncrementValueActionStepPayload):
        return IncrementValueStep(
            step_id=step.step_id,
            target=step.target,
            path=list(step.path),
            amount=_build_numeric_value(
                step.amount,
                available_variables=available_variables,
            ),
            **_bounds_kwargs(step, available_variables=available_variables),
        )
    if isinstance(step, DecrementValueActionStepPayload):
        return DecrementValueStep(
            step_id=step.step_id,
            target=step.target,
            path=list(step.path),
            amount=_build_numeric_value(
                step.amount,
                available_variables=available_variables,
            ),
            **_bounds_kwargs(step, available_variables=available_variables),
        )
    if isinstance(step, ResolveDamageActionStepPayload):
        return ResolveDamageStep(
            step_id=step.step_id,
            target=step.target,
            damage_type=step.damage_type,
            amount=_build_numeric_value(
                step.amount,
                available_variables=available_variables,
            ),
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
        amount=_build_numeric_value(
            step.amount,
            available_variables=available_variables,
        ),
    )


def _build_action(payload: ActionDefinitionPayload, state: State | None = None) -> Action:
    _validate_action_payload(payload, state)
    available_variables: set[str] = set()
    steps: list[ActionStep] = []
    for step in payload.steps:
        steps.append(
            _build_step(
                step,
                available_variables=available_variables,
            )
        )
        if isinstance(step, CalculateValueActionStepPayload):
            available_variables.add(step.variable_id)
    return Action(
        id=payload.id,
        name=payload.name,
        notes=payload.notes,
        steps=steps,
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
