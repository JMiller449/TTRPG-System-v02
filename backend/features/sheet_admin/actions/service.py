from __future__ import annotations

from copy import deepcopy
from dataclasses import asdict, is_dataclass

from backend.features.sheet_admin.actions.schema import (
    ActionDefinitionPayload,
    SendMessageActionStepPayload,
    SetValueActionStepPayload,
)
from backend.features.sheet_admin.formulas.service import build_formula
from backend.features.sheet_admin.shared.schema import (
    CreateEntity,
    DeleteEntity,
    UpdateEntity,
)
from backend.features.state_sync.service import state_sync_service
from backend.state.models.action import Action, SendMessageStep, SetValueStep
from backend.state.models.state import State


def _build_step(step: SendMessageActionStepPayload | SetValueActionStepPayload):
    if isinstance(step, SendMessageActionStepPayload):
        return SendMessageStep(
            step_id=step.step_id,
            message=build_formula(step.message),
        )
    return SetValueStep(
        step_id=step.step_id,
        target=step.target,
        path=list(step.path),
        value=build_formula(step.value),
    )


def _build_action(payload: ActionDefinitionPayload) -> Action:
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


async def create_action(request: CreateEntity) -> None:
    payload = ActionDefinitionPayload.model_validate(request.entity)
    action = _build_action(payload)

    def mutation(state: State) -> tuple[None, list]:
        actions = _actions_state(state)
        if payload.id in actions:
            raise ValueError(f"Action '{payload.id}' already exists.")
        path = state_sync_service.join_path("actions", payload.id)
        op = state_sync_service.add_mutation(state, path, action)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def update_action(request: UpdateEntity) -> None:
    def mutation(state: State) -> tuple[None, list]:
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

        action = _build_action(payload)
        path = state_sync_service.join_path("actions", request.entity_id)
        op = state_sync_service.set_mutation(state, path, action)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def delete_action(request: DeleteEntity) -> None:
    def mutation(state: State) -> tuple[None, list]:
        actions = _actions_state(state)
        if request.entity_id not in actions:
            raise ValueError(f"Action '{request.entity_id}' does not exist.")

        path = state_sync_service.join_path("actions", request.entity_id)
        _, op = state_sync_service.remove_mutation(state, path)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)
