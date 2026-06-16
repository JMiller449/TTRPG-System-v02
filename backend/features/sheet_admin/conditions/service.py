from __future__ import annotations

from copy import deepcopy
from dataclasses import asdict, is_dataclass

from backend.features.sheet_admin.conditions.schema import (
    ConditionPresetPayload,
    CreateConditionPreset,
    DeleteConditionPreset,
    UpdateConditionPreset,
)
from backend.features.state_sync.service import state_sync_service
from backend.state.models.condition import ConditionPreset
from backend.state.models.state import State


def _build_condition_preset(payload: ConditionPresetPayload) -> ConditionPreset:
    return ConditionPreset.from_dict(payload.model_dump(mode="json"))


def _merge_condition(current: dict, partial: dict) -> dict:
    merged = deepcopy(current)
    for key, value in partial.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _merge_condition(merged[key], value)
            continue
        merged[key] = value
    return merged


async def create_condition_preset(request: CreateConditionPreset) -> None:
    condition = _build_condition_preset(request.condition)

    def mutation(state: State) -> tuple[None, list]:
        if condition.id in state.condition_presets:
            raise ValueError(f"Condition preset '{condition.id}' already exists.")

        path = state_sync_service.join_path("condition_presets", condition.id)
        op = state_sync_service.add_mutation(state, path, condition)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def update_condition_preset(request: UpdateConditionPreset) -> None:
    def mutation(state: State) -> tuple[None, list]:
        current = state.condition_presets.get(request.condition_id)
        if current is None:
            raise ValueError(
                f"Condition preset '{request.condition_id}' does not exist."
            )

        merged = _merge_condition(
            asdict(current) if is_dataclass(current) else current,
            request.condition_partial,
        )
        payload = ConditionPresetPayload.model_validate(merged)
        if payload.id != request.condition_id:
            raise ValueError("Condition preset ID cannot be changed.")

        condition = _build_condition_preset(payload)
        path = state_sync_service.join_path("condition_presets", request.condition_id)
        op = state_sync_service.set_mutation(state, path, condition)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def delete_condition_preset(request: DeleteConditionPreset) -> None:
    def mutation(state: State) -> tuple[None, list]:
        if request.condition_id not in state.condition_presets:
            raise ValueError(
                f"Condition preset '{request.condition_id}' does not exist."
            )

        path = state_sync_service.join_path("condition_presets", request.condition_id)
        _, op = state_sync_service.remove_mutation(state, path)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)
