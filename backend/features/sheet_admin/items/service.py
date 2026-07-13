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
from backend.features.attributes.service import (
    validate_and_evaluate_subject_attributes,
    validate_subject_attribute_value,
)
from backend.features.sheet_admin.formulas.service import validate_formula_alias_paths
from backend.features.inventory.service import validate_inventory
from backend.features.state_sync.service import state_sync_service
from backend.features.variable_registry.service import is_augmentation_target_allowed
from backend.state.default_actions import (
    normalize_weapon_action_grant_payloads,
    seeded_global_actions,
)
from backend.state.models.augmentation import Augmentation, AugmentationSource
from backend.state.models.attribute import (
    WEAPON_ATTRIBUTE_IDS,
    WEAPON_GOVERNING_STAT_ATTRIBUTE_ID,
    WEAPON_PROFICIENCY_ATTRIBUTE_ID,
    AttributeBridge,
    AttributeDefinition,
    synchronize_required_item_attributes,
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


def _is_valid_numeric_attribute(bridge: AttributeBridge) -> bool:
    value = bridge.evaluated_value
    return (
        bridge.evaluation_error is None
        and isinstance(value, int | float)
        and not isinstance(value, bool)
    )


def _validate_item_numeric_attribute_alias(
    *,
    state: State,
    item: Item,
    attribute_id: str,
    alias_name: str,
) -> None:
    definition = state.attributes.get(attribute_id)
    if (
        definition is None
        or definition.value_type != "number"
        or "item" not in definition.subject_types
    ):
        raise ValueError(
            f"Formula alias '{alias_name}' does not reference a numeric item Attribute."
        )
    _validate_item_attribute_profile(definition, item, alias_name)
    bridge = item.attributes.get(attribute_id)
    if bridge is None or bridge.attribute_id != attribute_id:
        raise ValueError(
            f"Formula alias '{alias_name}' references Attribute '{attribute_id}', but it is "
            "not attached to this item."
        )
    if bridge.evaluation_error is not None:
        raise ValueError(
            f"Formula alias '{alias_name}' references invalid Attribute '{attribute_id}': "
            f"{bridge.evaluation_error}"
        )
    if not _is_valid_numeric_attribute(bridge):
        raise ValueError(
            f"Formula alias '{alias_name}' references Attribute '{attribute_id}', but its "
            "evaluated value is not numeric."
        )


def _validate_item_attribute_profile(
    definition: AttributeDefinition,
    item: Item,
    alias_name: str,
) -> None:
    if (
        definition.required_profile is not None
        and definition.required_profile != item.attribute_profile
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
        required_attribute_id = WEAPON_GOVERNING_STAT_ATTRIBUTE_ID
    elif path == ["source_item", "resolved", "proficiency_modifier"]:
        required_attribute_id = WEAPON_PROFICIENCY_ATTRIBUTE_ID
    else:
        raise ValueError(f"Source-item alias '{alias_name}' is not supported.")

    if item.attribute_profile != "weapon" or required_attribute_id not in item.attributes:
        raise ValueError(
            f"Source-item alias '{alias_name}' requires a weapon item with "
            f"Attribute '{required_attribute_id}'."
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
        if len(path) >= 2 and path[:2] == ["source_item", "attributes"]:
            if len(path) != 3:
                raise ValueError(
                    f"Source-item Attribute alias '{alias.name}' must reference "
                    "source_item.attributes.<attribute_id>."
                )
            _validate_item_numeric_attribute_alias(
                state=state,
                item=item,
                attribute_id=path[2],
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
    action_grants = (
        normalize_weapon_action_grant_payloads(
            grant.model_dump(mode="json") for grant in payload.action_grants
        )
        if payload.attribute_profile == "weapon"
        else [grant.model_dump(mode="json") for grant in payload.action_grants]
    )
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
        can_contain_items=payload.can_contain_items,
        contents_weight_behavior=payload.contents_weight_behavior,
        attribute_profile=payload.attribute_profile,
        augmentation_templates=_build_item_augmentation_templates(payload),
        action_grants=[
            ItemActionGrant(
                action_id=grant["action_id"],
                availability=grant["availability"],
                consume_quantity=grant["consume_quantity"],
            )
            for grant in action_grants
        ],
        attributes={
            attribute_id: AttributeBridge.from_dict(bridge.model_dump(mode="json"))
            for attribute_id, bridge in payload.attributes.items()
        },
    )


def _validate_item_attributes(item: Item, state: State) -> None:
    synchronize_required_item_attributes(item, state.attributes)
    relationship_ids: set[str] = set()
    for attribute_id, bridge in item.attributes.items():
        if bridge.attribute_id != attribute_id:
            raise ValueError(
                f"Item Attribute bridge key '{attribute_id}' does not match '{bridge.attribute_id}'."
            )
        if bridge.relationship_id in relationship_ids:
            raise ValueError(
                f"Item Attribute relationship '{bridge.relationship_id}' is duplicated."
            )
        relationship_ids.add(bridge.relationship_id)
        definition = state.attributes.get(attribute_id)
        if definition is None or "item" not in definition.subject_types:
            raise ValueError(f"Item Attribute '{attribute_id}' does not exist.")
        if (
            definition.required_profile is not None
            and definition.required_profile != item.attribute_profile
        ):
            raise ValueError(
                f"Attribute '{attribute_id}' requires item profile "
                f"'{definition.required_profile}'."
            )
        validate_subject_attribute_value(state, "item", item, definition, bridge.value)
        if definition.reference_kind == "proficiency":
            stored_value = (
                bridge.value.value if bridge.value.type != "formula" else None
            )
            if not isinstance(stored_value, str) or stored_value not in state.proficiencies:
                missing_id = stored_value if isinstance(stored_value, str) else ""
                raise ValueError(
                    f"Item Attribute '{attribute_id}' references nonexistent proficiency "
                    f"'{missing_id}'."
                )

    if item.attribute_profile == "weapon":
        missing = [attribute_id for attribute_id in WEAPON_ATTRIBUTE_IDS if attribute_id not in item.attributes]
        if missing:
            raise ValueError("Weapon profile is missing required Attributes: " + ", ".join(missing))
    validate_and_evaluate_subject_attributes(item)


def _validate_item_action_grants(item: Item, state: State) -> None:
    valid_action_ids = set(state.actions) | set(seeded_global_actions())
    for grant in item.action_grants:
        if grant.action_id not in valid_action_ids:
            raise ValueError(f"Action '{grant.action_id}' does not exist.")


def _add_missing_default_action_mutations(
    state: State,
    *,
    required_action_ids: set[str],
) -> list:
    ops = []
    for action_id, action in seeded_global_actions().items():
        if action_id not in required_action_ids:
            continue
        if action_id in state.actions:
            continue
        path = state_sync_service.join_path("actions", action_id)
        ops.append(state_sync_service.add_mutation(state, path, action))
    return ops


def _validate_existing_item_bridges(item: Item, state: State) -> None:
    if item.interaction_type != "equippable":
        equipped_sheet_ids = sorted(
            [
                sheet.id
                for sheet in state.sheets.values()
                if any(
                    bridge.item_id == item.id and bridge.equipped
                    for bridge in sheet.items.values()
                )
            ]
            + [
                instance_id
                for instance_id, instance in state.instanced_sheets.items()
                if any(
                    bridge.item_id == item.id and bridge.equipped
                    for bridge in instance.items.values()
                )
            ]
        )
        if equipped_sheet_ids:
            raise ValueError(
                f"Item '{item.id}' cannot become {item.interaction_type} while equipped on "
                f"sheets: {', '.join(equipped_sheet_ids)}."
            )

    item_definitions = dict(state.items)
    item_definitions[item.id] = item
    for sheet in state.sheets.values():
        validate_inventory(sheet.items, item_definitions)
    for instance in state.instanced_sheets.values():
        validate_inventory(instance.items, item_definitions)


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
        _validate_item_attributes(item, state)
        _validate_item_augmentation_formulas(item, state)
        _validate_item_action_grants(item, state)
        _validate_existing_item_bridges(item, state)
        action_ops = _add_missing_default_action_mutations(
            state,
            required_action_ids={grant.action_id for grant in item.action_grants},
        )
        path = state_sync_service.join_path("items", payload.id)
        op = state_sync_service.add_mutation(state, path, item)
        return None, [*action_ops, op]

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

        _validate_item_attributes(item, state)
        _validate_item_augmentation_formulas(item, state)
        _validate_item_action_grants(item, state)
        _validate_existing_item_bridges(item, state)
        action_ops = _add_missing_default_action_mutations(
            state,
            required_action_ids={grant.action_id for grant in item.action_grants},
        )
        path = state_sync_service.join_path("items", item_id)
        op = state_sync_service.set_mutation(state, path, item)
        return None, [*action_ops, op]

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
            [
                sheet.id
                for sheet in state.sheets.values()
                if any(bridge.item_id == item_id for bridge in sheet.items.values())
            ]
            + [
                instance_id
                for instance_id, instance in state.instanced_sheets.items()
                if any(bridge.item_id == item_id for bridge in instance.items.values())
            ]
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
