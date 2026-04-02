from __future__ import annotations

from copy import deepcopy
from dataclasses import asdict, is_dataclass

from backend.features.sheet_admin.formulas.service import build_formula
from backend.features.sheet_admin.items.schema import ItemDefinitionPayload
from backend.features.sheet_admin.shared.schema import (
    CreateEntity,
    DeleteEntity,
    UpdateEntity,
)
from backend.features.state_sync.service import state_sync_service
from backend.state.models.item import Item, StatAugmentation
from backend.state.models.state import State


def _build_item(payload: ItemDefinitionPayload) -> Item:
    return Item(
        id=payload.id,
        name=payload.name,
        description=payload.description,
        price=payload.price,
        weight=payload.weight,
        stat_augmentations=[
            StatAugmentation(
                stat_name=augmentation.stat_name,
                augmentation=build_formula(augmentation.augmentation),
            )
            for augmentation in payload.stat_augmentations
        ],
    )


def _items_state(state: State) -> dict[str, dict]:
    return state.items


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
        await create_item(request)
        return
    if isinstance(request, UpdateEntity):
        await update_item(request)
        return
    await delete_item(request)


async def create_item(request: CreateEntity) -> None:
    payload = ItemDefinitionPayload.model_validate(request.entity)
    item = _build_item(payload)

    def mutation(state: State) -> tuple[None, list]:
        items = _items_state(state)
        if payload.id in items:
            raise ValueError(f"Item '{payload.id}' already exists.")
        path = state_sync_service.join_path("items", payload.id)
        op = state_sync_service.add_mutation(state, path, item)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def update_item(request: UpdateEntity) -> None:
    def mutation(state: State) -> tuple[None, list]:
        items = _items_state(state)
        current = items.get(request.entity_id)
        if current is None:
            raise ValueError(f"Item '{request.entity_id}' does not exist.")

        merged = _merge_entity(
            asdict(current) if is_dataclass(current) else current,
            request.entity_partial,
        )
        payload = ItemDefinitionPayload.model_validate(merged)
        if payload.id != request.entity_id:
            raise ValueError("Item ID cannot be changed.")

        item = _build_item(payload)
        path = state_sync_service.join_path("items", request.entity_id)
        op = state_sync_service.set_mutation(state, path, item)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def delete_item(request: DeleteEntity) -> None:
    def mutation(state: State) -> tuple[None, list]:
        items = _items_state(state)
        if request.entity_id not in items:
            raise ValueError(f"Item '{request.entity_id}' does not exist.")

        path = state_sync_service.join_path("items", request.entity_id)
        _, op = state_sync_service.remove_mutation(state, path)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)
