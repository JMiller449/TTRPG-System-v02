from __future__ import annotations

from copy import deepcopy
from dataclasses import asdict, is_dataclass

from backend.features.sheet_admin.formulas.service import build_formula
from backend.features.sheet_admin.items.schema import (
    CreateItem,
    DeleteItem,
    ItemDefinitionPayload,
    RemoveItemAugmentationTemplate,
    UpdateItem,
    UpsertItemAugmentationTemplate,
)
from backend.features.sheet_admin.shared.schema import (
    CreateEntity,
    DeleteEntity,
    UpdateEntity,
)
from backend.features.state_sync.service import state_sync_service
from backend.state.models.augmentation import Augmentation
from backend.state.models.item import Item, StatAugmentation
from backend.state.models.state import State


def _validate_item_augmentation_template(augmentation: Augmentation) -> None:
    if augmentation.target.root == "state":
        raise ValueError("Item augmentation templates cannot target global state.")
    if augmentation.scope != augmentation.target.root:
        raise ValueError(
            "Item augmentation template scope must match its relative target root."
        )


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
        augmentation_templates=[
            Augmentation.from_dict(augmentation.model_dump(mode="json"))
            for augmentation in payload.augmentation_templates
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


async def _create_item(
    payload: ItemDefinitionPayload,
    *,
    request_id: str | None = None,
) -> None:
    item = _build_item(payload)

    def mutation(state: State) -> tuple[None, list]:
        items = _items_state(state)
        if payload.id in items:
            raise ValueError(f"Item '{payload.id}' already exists.")
        path = state_sync_service.join_path("items", payload.id)
        op = state_sync_service.add_mutation(state, path, item)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request_id)


async def _update_item(
    item_id: str,
    payload: ItemDefinitionPayload,
    *,
    request_id: str | None = None,
) -> None:
    if payload.id != item_id:
        raise ValueError("Item ID cannot be changed.")

    item = _build_item(payload)

    def mutation(state: State) -> tuple[None, list]:
        items = _items_state(state)
        if item_id not in items:
            raise ValueError(f"Item '{item_id}' does not exist.")

        path = state_sync_service.join_path("items", item_id)
        op = state_sync_service.set_mutation(state, path, item)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request_id)


async def _delete_item(
    item_id: str,
    *,
    request_id: str | None = None,
) -> None:
    def mutation(state: State) -> tuple[None, list]:
        items = _items_state(state)
        if item_id not in items:
            raise ValueError(f"Item '{item_id}' does not exist.")

        path = state_sync_service.join_path("items", item_id)
        _, op = state_sync_service.remove_mutation(state, path)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request_id)


async def create_item(request: CreateEntity) -> None:
    payload = ItemDefinitionPayload.model_validate(request.entity)
    await _create_item(payload, request_id=request.request_id)


async def update_item(request: UpdateEntity) -> None:
    def mutation(state: State) -> tuple[ItemDefinitionPayload, list]:
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
        return payload, []

    payload = await state_sync_service.apply_mutation(
        mutation,
        request_id=request.request_id,
    )
    await _update_item(request.entity_id, payload, request_id=request.request_id)


async def delete_item(request: DeleteEntity) -> None:
    await _delete_item(request.entity_id, request_id=request.request_id)


async def create_typed_item(request: CreateItem) -> None:
    await _create_item(request.item, request_id=request.request_id)


async def update_typed_item(request: UpdateItem) -> None:
    await _update_item(
        request.item_id,
        request.item,
        request_id=request.request_id,
    )


async def delete_typed_item(request: DeleteItem) -> None:
    await _delete_item(request.item_id, request_id=request.request_id)


async def upsert_item_augmentation_template(
    request: UpsertItemAugmentationTemplate,
) -> None:
    augmentation = Augmentation.from_dict(request.augmentation.model_dump(mode="json"))
    _validate_item_augmentation_template(augmentation)

    def mutation(state: State) -> tuple[None, list]:
        item = state.items.get(request.item_id)
        if item is None:
            raise ValueError(f"Item '{request.item_id}' does not exist.")

        for index, current in enumerate(item.augmentation_templates):
            if current.id == augmentation.id:
                path = state_sync_service.join_path(
                    "items",
                    request.item_id,
                    "augmentation_templates",
                    str(index),
                )
                op = state_sync_service.set_mutation(state, path, augmentation)
                return None, [op]

        path = state_sync_service.join_path(
            "items",
            request.item_id,
            "augmentation_templates",
            "-",
        )
        op = state_sync_service.add_mutation(state, path, augmentation)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def remove_item_augmentation_template(
    request: RemoveItemAugmentationTemplate,
) -> None:
    def mutation(state: State) -> tuple[None, list]:
        item = state.items.get(request.item_id)
        if item is None:
            raise ValueError(f"Item '{request.item_id}' does not exist.")

        for index, current in enumerate(item.augmentation_templates):
            if current.id == request.augmentation_id:
                path = state_sync_service.join_path(
                    "items",
                    request.item_id,
                    "augmentation_templates",
                    str(index),
                )
                _, op = state_sync_service.remove_mutation(state, path)
                return None, [op]

        raise ValueError(
            f"Item augmentation template '{request.augmentation_id}' does not exist."
        )

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)
