from __future__ import annotations

from copy import deepcopy
from dataclasses import asdict, is_dataclass

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
from backend.features.facts.service import validate_subject_fact_value
from backend.features.sheet_admin.formulas.service import validate_formula_alias_paths
from backend.features.state_sync.service import state_sync_service
from backend.features.variable_registry.service import is_augmentation_target_allowed
from backend.state.models.augmentation import Augmentation, AugmentationSource
from backend.state.models.fact import (
    WEAPON_FACT_IDS,
    WEAPON_GOVERNING_STAT_FACT_ID,
    WEAPON_PROFICIENCY_FACT_ID,
    FactBridge,
    FactDefinition,
    evaluate_all_subject_facts,
    synchronize_required_item_facts,
)
from backend.state.models.item import Item, ItemActionGrant
from backend.state.models.state import State


def _target_label(augmentation: Augmentation) -> str:
    path = ".".join(augmentation.target.path)
    return f"{augmentation.target.root}.{path}" if path else augmentation.target.root


def _validate_item_augmentation_template(augmentation: Augmentation) -> None:
    if augmentation.target.root == "state":
        raise ValueError("Item augmentation templates cannot target global state.")
    if augmentation.scope != augmentation.target.root:
        raise ValueError(
            "Item augmentation template scope must match its relative target root."
        )

    if not is_augmentation_target_allowed(
        root=augmentation.target.root,
        path=augmentation.target.path,
        context="item_template",
    ):
        raise ValueError(
            "Item augmentation template target "
            f"'{_target_label(augmentation)}' is not allowed."
        )


def _is_valid_numeric_fact(bridge: FactBridge) -> bool:
    value = bridge.evaluated_value
    return (
        bridge.evaluation_error is None
        and isinstance(value, int | float)
        and not isinstance(value, bool)
    )


def _validate_item_numeric_fact_alias(
    *,
    state: State,
    item: Item,
    fact_id: str,
    alias_name: str,
) -> None:
    definition = state.facts.get(fact_id)
    if (
        definition is None
        or definition.value_type != "number"
        or "item" not in definition.subject_types
    ):
        raise ValueError(
            f"Formula alias '{alias_name}' does not reference a numeric item Fact."
        )
    _validate_item_fact_profile(definition, item, alias_name)
    bridge = item.facts.get(fact_id)
    if bridge is None or bridge.fact_id != fact_id:
        raise ValueError(
            f"Formula alias '{alias_name}' references Fact '{fact_id}', but it is "
            "not attached to this item."
        )
    if bridge.evaluation_error is not None:
        raise ValueError(
            f"Formula alias '{alias_name}' references invalid Fact '{fact_id}': "
            f"{bridge.evaluation_error}"
        )
    if not _is_valid_numeric_fact(bridge):
        raise ValueError(
            f"Formula alias '{alias_name}' references Fact '{fact_id}', but its "
            "evaluated value is not numeric."
        )


def _validate_item_fact_profile(
    definition: FactDefinition,
    item: Item,
    alias_name: str,
) -> None:
    if (
        definition.required_profile is not None
        and definition.required_profile != item.fact_profile
    ):
        raise ValueError(
            f"Formula alias '{alias_name}' requires source-item profile "
            f"'{definition.required_profile}'."
        )


def _validate_item_resolved_alias(
    *,
    item: Item,
    path: list[str],
    alias_name: str,
) -> None:
    if path == ["source_item", "resolved", "governing_stat"]:
        required_fact_id = WEAPON_GOVERNING_STAT_FACT_ID
    elif path == ["source_item", "resolved", "proficiency_modifier"]:
        required_fact_id = WEAPON_PROFICIENCY_FACT_ID
    else:
        raise ValueError(f"Source-item alias '{alias_name}' is not supported.")

    if item.fact_profile != "weapon" or required_fact_id not in item.facts:
        raise ValueError(
            f"Source-item alias '{alias_name}' requires a weapon item with "
            f"Fact '{required_fact_id}'."
        )


def _validate_item_augmentation_formula_aliases(
    *,
    state: State,
    item: Item,
    augmentation: Augmentation,
) -> None:
    if augmentation.effect.type == "roll_mode_modifier":
        return

    formula = augmentation.effect.value
    validate_formula_alias_paths(formula, state=state)
    for alias in formula.aliases or []:
        path = list(alias.path)
        if path and path[0] == "action":
            if augmentation.effect.type == "formula_modifier":
                raise ValueError(
                    f"Formula alias '{alias.name}' cannot use action context in a "
                    "direct wearer effect."
                )
            continue
        if len(path) >= 2 and path[:2] == ["source_item", "facts"]:
            if len(path) != 3:
                raise ValueError(
                    f"Source-item Fact alias '{alias.name}' must reference "
                    "source_item.facts.<fact_id>."
                )
            _validate_item_numeric_fact_alias(
                state=state,
                item=item,
                fact_id=path[2],
                alias_name=alias.name,
            )
            continue
        if path[:2] == ["source_item", "resolved"]:
            if augmentation.effect.type == "formula_modifier":
                raise ValueError(
                    f"Formula alias '{alias.name}' cannot use resolved source-item "
                    "context in a direct wearer effect."
                )
            _validate_item_resolved_alias(
                item=item,
                path=path,
                alias_name=alias.name,
            )


def _validate_item_augmentation_formulas(item: Item, state: State) -> None:
    for augmentation in item.augmentation_templates:
        _validate_item_augmentation_formula_aliases(
            state=state,
            item=item,
            augmentation=augmentation,
        )


def _build_item_augmentation_templates(
    payload: ItemDefinitionPayload,
) -> list[Augmentation]:
    augmentations = [
        Augmentation.from_dict(augmentation.model_dump(mode="json"))
        for augmentation in payload.augmentation_templates
    ]
    for augmentation in augmentations:
        augmentation.source = AugmentationSource(
            type="item",
            id=payload.id,
            label=payload.name,
        )
        augmentation.lifecycle_owner = "equipment"
        augmentation.applied = False
        augmentation.applied_target_id = None
        _validate_item_augmentation_template(augmentation)
    return augmentations


def _build_item(payload: ItemDefinitionPayload) -> Item:
    return Item(
        id=payload.id,
        name=payload.name,
        interaction_type=payload.interaction_type,
        category=payload.category,
        rank=payload.rank,
        description=payload.description,
        world_anvil_url=payload.world_anvil_url,
        gm_notes=payload.gm_notes,
        gm_special_properties=payload.gm_special_properties,
        price=payload.price,
        weight=payload.weight,
        fact_profile=payload.fact_profile,
        augmentation_templates=_build_item_augmentation_templates(payload),
        action_grants=[
            ItemActionGrant(
                action_id=grant.action_id,
                availability=grant.availability,
                consume_quantity=grant.consume_quantity,
            )
            for grant in payload.action_grants
        ],
        facts={
            fact_id: FactBridge.from_dict(bridge.model_dump(mode="json"))
            for fact_id, bridge in payload.facts.items()
        },
    )


def _validate_item_facts(item: Item, state: State) -> None:
    synchronize_required_item_facts(item, state.facts)
    relationship_ids: set[str] = set()
    for fact_id, bridge in item.facts.items():
        if bridge.fact_id != fact_id:
            raise ValueError(
                f"Item Fact bridge key '{fact_id}' does not match '{bridge.fact_id}'."
            )
        if bridge.relationship_id in relationship_ids:
            raise ValueError(
                f"Item Fact relationship '{bridge.relationship_id}' is duplicated."
            )
        relationship_ids.add(bridge.relationship_id)
        definition = state.facts.get(fact_id)
        if definition is None or "item" not in definition.subject_types:
            raise ValueError(f"Item Fact '{fact_id}' does not exist.")
        if (
            definition.required_profile is not None
            and definition.required_profile != item.fact_profile
        ):
            raise ValueError(
                f"Fact '{fact_id}' requires item profile "
                f"'{definition.required_profile}'."
            )
        validate_subject_fact_value(state, "item", item, definition, bridge.value)

    if item.fact_profile == "weapon":
        missing = [fact_id for fact_id in WEAPON_FACT_IDS if fact_id not in item.facts]
        if missing:
            raise ValueError("Weapon profile is missing required Facts: " + ", ".join(missing))
    evaluate_all_subject_facts(item)


def _validate_item_action_grants(item: Item, state: State) -> None:
    for grant in item.action_grants:
        if grant.action_id not in state.actions:
            raise ValueError(f"Action '{grant.action_id}' does not exist.")


def _validate_existing_item_bridges(item: Item, state: State) -> None:
    if item.interaction_type == "equippable":
        return

    equipped_sheet_ids = sorted(
        sheet.id
        for sheet in state.sheets.values()
        if any(
            bridge.item_id == item.id and bridge.equipped
            for bridge in sheet.items.values()
        )
    )
    if equipped_sheet_ids:
        raise ValueError(
            f"Item '{item.id}' cannot become {item.interaction_type} while equipped on "
            f"sheets: {', '.join(equipped_sheet_ids)}."
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
        _validate_item_facts(item, state)
        _validate_item_augmentation_formulas(item, state)
        _validate_item_action_grants(item, state)
        _validate_existing_item_bridges(item, state)
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

        _validate_item_facts(item, state)
        _validate_item_augmentation_formulas(item, state)
        _validate_item_action_grants(item, state)
        _validate_existing_item_bridges(item, state)
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

        sheet_ids = sorted(
            sheet.id
            for sheet in state.sheets.values()
            if any(bridge.item_id == item_id for bridge in sheet.items.values())
        )
        if sheet_ids:
            raise ValueError(
                f"Item '{item_id}' cannot be deleted while attached to sheets: "
                f"{', '.join(sheet_ids)}."
            )

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
    augmentation.source = AugmentationSource(type="item", id=request.item_id)
    augmentation.lifecycle_owner = "equipment"
    augmentation.applied = False
    augmentation.applied_target_id = None
    _validate_item_augmentation_template(augmentation)

    def mutation(state: State) -> tuple[None, list]:
        item = state.items.get(request.item_id)
        if item is None:
            raise ValueError(f"Item '{request.item_id}' does not exist.")
        if item.interaction_type != "equippable":
            raise ValueError("Only equippable items can have augmentation templates.")
        augmentation.source.label = item.name
        candidate = deepcopy(item)
        replaced = False
        for index, current in enumerate(candidate.augmentation_templates):
            if current.id == augmentation.id:
                candidate.augmentation_templates[index] = augmentation
                replaced = True
                break
        if not replaced:
            candidate.augmentation_templates.append(augmentation)
        _validate_item_augmentation_formulas(candidate, state)

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
