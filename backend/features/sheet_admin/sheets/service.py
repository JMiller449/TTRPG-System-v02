from __future__ import annotations

from copy import deepcopy
from dataclasses import asdict, is_dataclass

from backend.features.sheet_admin.formulas.service import (
    build_formula,
    validate_formula_payload_paths,
)
from backend.features.formula_runtime.service import (
    evaluate_numeric_formula,
    evaluate_resource_maximum,
)
from backend.features.inventory.service import validate_inventory
from backend.features.sheet_admin.shared.schema import (
    CreateEntity,
    DeleteEntity,
    UpdateEntity,
)
from backend.features.sheet_admin.sheets.schema import (
    ActionBridgePayload,
    AdjustInstancedSheetResource,
    CreateInstancedSheet,
    CreateInstancedSheetActionBridge,
    CreateInstancedSheetItemBridge,
    CreateInstancedSheetProficiencyBridge,
    CreateSheetFromInstance,
    CreateSheetActionBridge,
    CreateSheetItemBridge,
    CreateSheetProficiencyBridge,
    CreateSheet,
    DeleteInstancedSheet,
    DeleteSheetActionBridge,
    DeleteSheetItemBridge,
    DeleteSheetProficiencyBridge,
    DeleteSheet,
    DeleteInstancedSheetActionBridge,
    DeleteInstancedSheetItemBridge,
    DeleteInstancedSheetProficiencyBridge,
    ItemBridgePayload,
    MoveInstancedSheetItem,
    ProficiencyBridgePayload,
    ResistancesPayload,
    SetInstancedSheetNotes,
    SetInstancedSheetProfile,
    SetInstancedSheetResource,
    SetSheetNotes,
    SheetDefinitionPayload,
    SheetActionBridgePayload,
    StatsPayload,
    UpdateSheetActionBridge,
    UpdateSheetItemBridge,
    UpdateSheetProficiencyBridge,
    UpdateSheet,
    UpdateInstancedSheetActionBridge,
    UpdateInstancedSheetItemBridge,
    UpdateInstancedSheetProficiencyBridge,
)
from backend.features.sheet_access import service as sheet_access_service
from backend.features.sheet_access.schema import SheetAccessCodes
from backend.features.state_sync.service import state_sync_service
from backend.features.attributes.service import (
    validate_and_evaluate_sheet_attributes,
    validate_attribute_formula_paths,
    validate_subject_attribute_value,
)
from backend.state.default_actions import (
    BASELINE_SHEET_CHECKS,
    WEAPON_ACTION_IDS,
    required_sheet_action_ids,
    seeded_global_actions,
)
from backend.state.models.action import Action, RollResult, SendRollStep
from backend.state.models.formula import Formula, FormulaAliases
from backend.state.models.attribute import (
    WEAPON_ATTRIBUTE_PROFILE,
    WEAPON_PROFICIENCY_ATTRIBUTE_ID,
    WEAPON_PROFICIENCY_GROWTH_RATE_ATTRIBUTE_ID,
    AttributeBridge,
    synchronize_required_sheet_attributes,
)
from backend.state.models.item import ItemBridge
from backend.state.models.character_profile import CharacterProfile
from backend.state.models.proficiency import ProficiencyBridge
from backend.state.models.resistance import Resistances
from backend.state.models.shared import Bridge
from backend.state.models.sheet import InstancedSheet, Sheet
from backend.state.models.stat import Stats
from backend.state.models.state import State

def _build_stats(
    payload: StatsPayload,
    *,
    attached_attribute_ids: set[str] | None = None,
) -> Stats:
    additional_paths = {
        ("attributes", attribute_id) for attribute_id in (attached_attribute_ids or set())
    }
    _validate_stats_formula_paths(payload, additional_paths=additional_paths)
    return Stats(
        strength=payload.strength,
        dexterity=payload.dexterity,
        constitution=payload.constitution,
        perception=payload.perception,
        arcane=payload.arcane,
        will=payload.will,
        lifting=build_formula(payload.lifting, additional_paths=additional_paths),
        carry_weight=build_formula(payload.carry_weight, additional_paths=additional_paths),
        acrobatics=build_formula(payload.acrobatics, additional_paths=additional_paths),
        stamina=build_formula(payload.stamina, additional_paths=additional_paths),
        reaction_time=build_formula(payload.reaction_time, additional_paths=additional_paths),
        health=build_formula(payload.health, additional_paths=additional_paths),
        endurance=build_formula(payload.endurance, additional_paths=additional_paths),
        pain_tolerance=build_formula(payload.pain_tolerance, additional_paths=additional_paths),
        sight_distance=build_formula(payload.sight_distance, additional_paths=additional_paths),
        intuition=build_formula(payload.intuition, additional_paths=additional_paths),
        registration=build_formula(payload.registration, additional_paths=additional_paths),
        mana=build_formula(payload.mana, additional_paths=additional_paths),
        control=build_formula(payload.control, additional_paths=additional_paths),
        sensitivity=build_formula(payload.sensitivity, additional_paths=additional_paths),
        charisma=build_formula(payload.charisma, additional_paths=additional_paths),
        mental_fortitude=build_formula(payload.mental_fortitude, additional_paths=additional_paths),
        courage=build_formula(payload.courage, additional_paths=additional_paths),
    )


def _build_resistances(payload: ResistancesPayload) -> Resistances:
    return Resistances(
        resistance=payload.resistance,
        physical=payload.physical,
        magical=payload.magical,
        slashing=payload.slashing,
        bludgeoning=payload.bludgeoning,
        piercing=payload.piercing,
        arcane=payload.arcane,
        fire=payload.fire,
        water=payload.water,
        earth=payload.earth,
        wind=payload.wind,
        light=payload.light,
        dark=payload.dark,
        lightning=payload.lightning,
        ice=payload.ice,
        time=payload.time,
        gravity=payload.gravity,
        psychic=payload.psychic,
    )


def build_instanced_sheet_from_template(
    template: Sheet,
    *,
    parent_sheet_id: str,
    notes: str = "",
    health: float | None = None,
    mana: int | None = None,
    resistances: Resistances | None = None,
) -> InstancedSheet:
    """Build an independent runtime copy without persistence or access-code effects."""

    resolved_health = (
        health
        if health is not None
        else evaluate_resource_maximum(template, "health")
    )
    resolved_mana = (
        mana
        if mana is not None
        else evaluate_resource_maximum(template, "mana")
    )
    if not float(resolved_mana).is_integer():
        raise ValueError(
            f"Sheet '{parent_sheet_id}' mana formula must resolve to a whole number."
        )

    template_reaction_bridge = template.attributes.get("amount_of_reactions")
    template_reaction_limit = (
        template_reaction_bridge.evaluated_value
        if template_reaction_bridge is not None
        and isinstance(template_reaction_bridge.evaluated_value, int | float)
        and not isinstance(template_reaction_bridge.evaluated_value, bool)
        else 0
    )

    return InstancedSheet(
        parent_id=parent_sheet_id,
        notes=notes,
        profile=deepcopy(template.profile),
        health=resolved_health,
        mana=int(resolved_mana),
        resistances=deepcopy(
            resistances if resistances is not None else template.resistances
        ),
        augments={},
        stats=deepcopy(template.stats),
        items=deepcopy(template.items),
        proficiencies=deepcopy(template.proficiencies),
        actions=deepcopy(template.actions),
        attributes=deepcopy(template.attributes),
        racial_hp_multiplier=template.racial_hp_multiplier,
        max_health=deepcopy(template.max_health),
        max_mana=deepcopy(template.max_mana),
        stat_bonuses=deepcopy(template.stat_bonuses),
        reactions=max(0, round(float(template_reaction_limit), 2)),
    )


def _build_sheet(payload: SheetDefinitionPayload) -> Sheet:
    stats = _build_stats(
        payload.stats,
        attached_attribute_ids=set(payload.attributes),
    )
    return Sheet(
        id=payload.id,
        name=payload.name,
        notes=payload.notes,
        profile=CharacterProfile.from_dict(payload.profile.model_dump(mode="json")),
        dm_only=payload.dm_only,
        xp_given_when_slayed=payload.xp_given_when_slayed,
        xp_cap=payload.xp_cap,
        proficiencies={
            key: ProficiencyBridge(
                relationship_id=bridge.relationship_id,
                prof_id=bridge.prof_id,
                use_count=bridge.use_count,
                growth_rate=bridge.growth_rate,
            )
            for key, bridge in payload.proficiencies.items()
        },
        items={
            key: ItemBridge(
                relationship_id=bridge.relationship_id,
                count=bridge.count,
                equipped=bridge.equipped,
                item_id=bridge.item_id,
                parent_container_id=bridge.parent_container_id,
            )
            for key, bridge in payload.items.items()
        },
        stats=stats,
        racial_hp_multiplier=payload.racial_hp_multiplier,
        max_health=(
            build_formula(
                payload.max_health,
                additional_paths={("attributes", key) for key in payload.attributes},
            )
            if payload.max_health is not None
            else deepcopy(stats.health)
        ),
        max_mana=(
            build_formula(
                payload.max_mana,
                additional_paths={("attributes", key) for key in payload.attributes},
            )
            if payload.max_mana is not None
            else deepcopy(stats.mana)
        ),
        stat_bonuses=dict(payload.stat_bonuses),
        resistances=_build_resistances(payload.resistances),
        actions={
            key: Bridge(
                relationship_id=bridge.relationship_id,
                entry_id=bridge.entry_id,
            )
            for key, bridge in payload.actions.items()
        },
        attributes={
            attribute_id: AttributeBridge.from_dict(bridge.model_dump(mode="json"))
            for attribute_id, bridge in payload.attributes.items()
        },
    )


def _sheet_payload_from_instance(
    *,
    sheet_id: str,
    name: str,
    notes: str,
    dm_only: bool,
    instance: InstancedSheet,
) -> SheetDefinitionPayload:
    if instance.stats is None:
        raise ValueError(
            f"Instance '{sheet_id}' cannot be snapshotted because it has no runtime stats."
        )
    return SheetDefinitionPayload.model_validate(
        {
            "id": sheet_id,
            "name": name,
            "notes": notes,
            "profile": asdict(instance.profile),
            "dm_only": dm_only,
            "xp_given_when_slayed": 0,
            "xp_cap": 0,
            "proficiencies": {
                key: asdict(bridge)
                for key, bridge in instance.proficiencies.items()
            },
            "items": {
                key: asdict(bridge)
                for key, bridge in instance.items.items()
            },
            "stats": asdict(instance.stats),
            "racial_hp_multiplier": instance.racial_hp_multiplier,
            "max_health": asdict(instance.max_health),
            "max_mana": asdict(instance.max_mana),
            "stat_bonuses": dict(instance.stat_bonuses),
            "resistances": asdict(instance.resistances),
            "actions": {
                key: asdict(bridge)
                for key, bridge in instance.actions.items()
            },
            "attributes": {
                key: asdict(bridge)
                for key, bridge in instance.attributes.items()
            },
        }
    )


def _validate_sheet_attributes(sheet: Sheet, state: State) -> None:
    authored_attribute_ids = set(sheet.attributes)
    synchronize_required_sheet_attributes(sheet)
    attached_attribute_ids = set(sheet.attributes)
    relationship_ids: set[str] = set()
    for attribute_id, bridge in sheet.attributes.items():
        if bridge.attribute_id != attribute_id:
            raise ValueError(
                f"Sheet Attribute bridge key '{attribute_id}' does not match '{bridge.attribute_id}'."
            )
        if bridge.relationship_id in relationship_ids:
            raise ValueError(
                f"Sheet Attribute relationship '{bridge.relationship_id}' is duplicated."
            )
        relationship_ids.add(bridge.relationship_id)
        definition = state.attributes.get(attribute_id)
        if definition is None or "sheet" not in definition.subject_types:
            raise ValueError(f"Sheet Attribute '{attribute_id}' does not exist.")
        validate_subject_attribute_value(
            state,
            "sheet",
            sheet,
            definition,
            bridge.value,
            attached_attribute_ids=attached_attribute_ids,
        )

    for value in vars(sheet.stats).values():
        if isinstance(value, Formula):
            validate_attribute_formula_paths(
                state,
                value,
                subject_types=["sheet"],
                attached_attribute_ids=attached_attribute_ids,
            )
    validate_and_evaluate_sheet_attributes(sheet, authored_attribute_ids)


def _baseline_check_action_id(stat_name: str) -> str:
    return f"baseline_check_{stat_name}"


def _default_action_relationship_id(action_id: str) -> str:
    return f"default_{action_id}"


def _baseline_check_relationship_id(stat_name: str) -> str:
    return _default_action_relationship_id(_baseline_check_action_id(stat_name))


def _build_baseline_check_action(stat_name: str, label: str) -> Action:
    return Action(
        id=_baseline_check_action_id(stat_name),
        name=f"{label} Check",
        roll_mode_kind="check",
        notes="Default baseline sheet check. Emits a Roll20 d100 stat check.",
        steps=[
            SendRollStep(
                step_id="roll",
                title=f"{label} Check",
                presentation="simple",
                rolls=[
                    RollResult(
                        label="Result",
                        value=Formula(
                            aliases=[
                                FormulaAliases(
                                    name=stat_name,
                                    path=["stats", stat_name],
                                )
                            ],
                            text=f"(1d100 / 100) * @{stat_name}",
                        ),
                    )
                ],
            )
        ],
    )


def _baseline_check_actions() -> dict[str, Action]:
    return {
        _baseline_check_action_id(stat_name): _build_baseline_check_action(
            stat_name,
            label,
        )
        for stat_name, label in BASELINE_SHEET_CHECKS
    }


def _default_action_definitions() -> dict[str, Action]:
    return {
        **_baseline_check_actions(),
        **seeded_global_actions(),
    }


def _new_sheet_default_action_ids() -> tuple[str, ...]:
    return required_sheet_action_ids()


def _with_default_action_bridges(
    payload: SheetDefinitionPayload,
) -> SheetDefinitionPayload:
    actions = dict(payload.actions)
    for action_id in _new_sheet_default_action_ids():
        relationship_id = _default_action_relationship_id(action_id)
        actions.setdefault(
            relationship_id,
            ActionBridgePayload(
                relationship_id=relationship_id,
                entry_id=action_id,
            ),
        )
    return payload.model_copy(update={"actions": actions})


def _add_missing_default_action_mutations(state: State) -> list:
    ops = []
    for action_id, action in _default_action_definitions().items():
        if action_id in state.actions:
            continue
        path = state_sync_service.join_path("actions", action_id)
        ops.append(state_sync_service.add_mutation(state, path, action))
    return ops


def _validate_relationship_key(
    *,
    relationship_kind: str,
    key: str,
    relationship_id: str,
) -> None:
    if key != relationship_id:
        raise ValueError(
            f"{relationship_kind} key '{key}' must match relationship_id "
            f"'{relationship_id}'."
        )


def _validate_proficiency_reference(proficiency_id: str, state: State) -> None:
    if proficiency_id not in state.proficiencies:
        raise ValueError(f"Proficiency '{proficiency_id}' does not exist.")


def _validate_item_bridge(payload: ItemBridgePayload, state: State) -> None:
    item = state.items.get(payload.item_id)
    if item is None:
        raise ValueError(f"Item '{payload.item_id}' does not exist.")
    if not payload.equipped:
        return
    if item.interaction_type != "equippable":
        raise ValueError(f"Item '{item.id}' is not equippable.")
    if payload.count <= 0:
        raise ValueError("An equipped item must have a positive quantity.")


def _validate_stats_formula_paths(
    payload: StatsPayload,
    *,
    additional_paths: set[tuple[str, ...]] | None = None,
) -> None:
    for formula in (
        payload.lifting,
        payload.carry_weight,
        payload.acrobatics,
        payload.stamina,
        payload.reaction_time,
        payload.health,
        payload.endurance,
        payload.pain_tolerance,
        payload.sight_distance,
        payload.intuition,
        payload.registration,
        payload.mana,
        payload.control,
        payload.sensitivity,
        payload.charisma,
        payload.mental_fortitude,
        payload.courage,
    ):
        validate_formula_payload_paths(formula, additional_paths=additional_paths)


def _validate_sheet_references(
    payload: SheetDefinitionPayload,
    state: State,
    *,
    extra_action_ids: set[str] | None = None,
) -> None:
    valid_action_ids = set(state.actions)
    if extra_action_ids is not None:
        valid_action_ids.update(extra_action_ids)

    for key, bridge in payload.actions.items():
        _validate_relationship_key(
            relationship_kind="Sheet action bridge",
            key=key,
            relationship_id=bridge.relationship_id,
        )
        if bridge.entry_id not in valid_action_ids:
            raise ValueError(f"Action '{bridge.entry_id}' does not exist.")

    for key, bridge in payload.items.items():
        _validate_relationship_key(
            relationship_kind="Sheet item bridge",
            key=key,
            relationship_id=bridge.relationship_id,
        )
        _validate_item_bridge(bridge, state)

    validate_inventory(
        {
            key: _build_sheet_item_bridge(bridge)
            for key, bridge in payload.items.items()
        },
        state.items,
    )

    for key, bridge in payload.proficiencies.items():
        _validate_relationship_key(
            relationship_kind="Sheet proficiency bridge",
            key=key,
            relationship_id=bridge.relationship_id,
        )
        _validate_proficiency_reference(bridge.prof_id, state)

def _build_sheet_action_bridge(payload: SheetActionBridgePayload) -> Bridge:
    return Bridge(
        relationship_id=payload.relationship_id,
        entry_id=payload.action_id,
    )


def _build_sheet_item_bridge(payload: ItemBridgePayload) -> ItemBridge:
    return ItemBridge(
        relationship_id=payload.relationship_id,
        count=payload.count,
        equipped=payload.equipped,
        item_id=payload.item_id,
        parent_container_id=payload.parent_container_id,
    )


def _build_sheet_proficiency_bridge(
    payload: ProficiencyBridgePayload,
) -> ProficiencyBridge:
    return ProficiencyBridge(
        relationship_id=payload.relationship_id,
        prof_id=payload.prof_id,
        use_count=payload.use_count,
        growth_rate=payload.growth_rate,
    )


def _valid_weapon_proficiency_values(
    item_id: str,
    state: State,
) -> tuple[str, float] | None:
    item = state.items.get(item_id)
    if item is None or item.attribute_profile != WEAPON_ATTRIBUTE_PROFILE:
        return None
    proficiency_bridge = item.attributes.get(WEAPON_PROFICIENCY_ATTRIBUTE_ID)
    growth_rate_bridge = item.attributes.get(WEAPON_PROFICIENCY_GROWTH_RATE_ATTRIBUTE_ID)
    if proficiency_bridge is None or growth_rate_bridge is None:
        return None
    proficiency_id = proficiency_bridge.evaluated_value
    growth_rate = growth_rate_bridge.evaluated_value
    if (
        not isinstance(proficiency_id, str)
        or not proficiency_id
        or proficiency_id not in state.proficiencies
    ):
        return None
    if (
        isinstance(growth_rate, bool)
        or not isinstance(growth_rate, int | float)
        or growth_rate < 0
    ):
        return None
    return proficiency_id, float(growth_rate)


def _weapon_proficiency_relationship_id(sheet: Sheet, proficiency_id: str) -> str:
    base = f"weapon_proficiency_{proficiency_id}"
    if base not in sheet.proficiencies:
        return base
    if sheet.proficiencies[base].prof_id == proficiency_id:
        return base

    suffix = 2
    while True:
        candidate = f"{base}_{suffix}"
        if candidate not in sheet.proficiencies:
            return candidate
        if sheet.proficiencies[candidate].prof_id == proficiency_id:
            return candidate
        suffix += 1


def _add_weapon_proficiency_bridge_mutations(
    state: State,
    *,
    sheet_id: str,
    sheet: Sheet,
    item_bridge: ItemBridge,
) -> list:
    if not item_bridge.equipped:
        return []
    values = _valid_weapon_proficiency_values(item_bridge.item_id, state)
    if values is None:
        return []
    proficiency_id, growth_rate = values
    if any(bridge.prof_id == proficiency_id for bridge in sheet.proficiencies.values()):
        return []

    relationship_id = _weapon_proficiency_relationship_id(sheet, proficiency_id)
    bridge = ProficiencyBridge(
        relationship_id=relationship_id,
        prof_id=proficiency_id,
        use_count=0,
        growth_rate=growth_rate,
    )
    path = state_sync_service.join_path(
        "sheets",
        sheet_id,
        "proficiencies",
        relationship_id,
    )
    return [state_sync_service.add_mutation(state, path, bridge)]


def _sync_equipped_weapon_proficiencies_for_sheet(
    state: State,
    *,
    sheet_id: str,
    sheet: Sheet,
) -> None:
    for item_bridge in sheet.items.values():
        if not item_bridge.equipped:
            continue
        values = _valid_weapon_proficiency_values(item_bridge.item_id, state)
        if values is None:
            continue
        proficiency_id, growth_rate = values
        if any(bridge.prof_id == proficiency_id for bridge in sheet.proficiencies.values()):
            continue
        relationship_id = _weapon_proficiency_relationship_id(sheet, proficiency_id)
        sheet.proficiencies[relationship_id] = ProficiencyBridge(
            relationship_id=relationship_id,
            prof_id=proficiency_id,
            use_count=0,
            growth_rate=growth_rate,
        )


def _remove_weapon_action_bridges(sheet: Sheet) -> None:
    for relationship_id, bridge in list(sheet.actions.items()):
        if bridge.entry_id in WEAPON_ACTION_IDS:
            sheet.actions.pop(relationship_id)


def _sheets_state(state: State) -> dict[str, dict]:
    return state.sheets


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
        await create_sheet(request)
        return
    if isinstance(request, UpdateEntity):
        await update_sheet(request)
        return
    await delete_sheet(request)


async def _create_sheet(
    payload: SheetDefinitionPayload,
    *,
    request_id: str | None = None,
) -> None:
    payload = _with_default_action_bridges(payload)
    sheet = _build_sheet(payload)
    default_actions = _default_action_definitions()

    def mutation(state: State) -> tuple[None, list]:
        sheets = _sheets_state(state)
        if payload.id in sheets:
            raise ValueError(f"Sheet '{payload.id}' already exists.")
        _validate_sheet_references(
            payload,
            state,
            extra_action_ids=set(default_actions),
        )
        _validate_sheet_attributes(sheet, state)
        _remove_weapon_action_bridges(sheet)
        _sync_equipped_weapon_proficiencies_for_sheet(
            state,
            sheet_id=payload.id,
            sheet=sheet,
        )
        default_action_ops = _add_missing_default_action_mutations(state)
        path = state_sync_service.join_path("sheets", payload.id)
        op = state_sync_service.add_mutation(state, path, sheet)
        return None, [*default_action_ops, op]

    await state_sync_service.apply_mutation(mutation, request_id=request_id)


async def _update_sheet(
    sheet_id: str,
    payload: SheetDefinitionPayload,
    *,
    request_id: str | None = None,
) -> None:
    payload = _with_default_action_bridges(payload)
    default_actions = _default_action_definitions()
    if payload.id != sheet_id:
        raise ValueError("Sheet ID cannot be changed.")

    def mutation(state: State) -> tuple[None, list]:
        sheets = _sheets_state(state)
        if sheet_id not in sheets:
            raise ValueError(f"Sheet '{sheet_id}' does not exist.")

        _validate_sheet_references(
            payload,
            state,
            extra_action_ids=set(default_actions),
        )
        sheet = _build_sheet(payload)
        _validate_sheet_attributes(sheet, state)
        _remove_weapon_action_bridges(sheet)
        _sync_equipped_weapon_proficiencies_for_sheet(
            state,
            sheet_id=sheet_id,
            sheet=sheet,
        )
        default_action_ops = _add_missing_default_action_mutations(state)
        path = state_sync_service.join_path("sheets", sheet_id)
        op = state_sync_service.set_mutation(state, path, sheet)
        return None, [*default_action_ops, op]

    await state_sync_service.apply_mutation(mutation, request_id=request_id)


async def _delete_sheet(
    sheet_id: str,
    *,
    request_id: str | None = None,
) -> None:
    def mutation(state: State) -> tuple[None, list]:
        sheets = _sheets_state(state)
        if sheet_id not in sheets:
            raise ValueError(f"Sheet '{sheet_id}' does not exist.")
        instance_ids = sorted(
            instance_id
            for instance_id, instance in state.instanced_sheets.items()
            if instance.parent_id == sheet_id
        )
        encounter_ids = sorted(
            encounter_id
            for encounter_id, encounter in state.encounter_presets.items()
            if any(entry.template_id == sheet_id for entry in encounter.entries)
        )
        dependencies: list[str] = []
        if instance_ids:
            dependencies.append(f"instances: {', '.join(instance_ids)}")
        if encounter_ids:
            dependencies.append(f"encounter presets: {', '.join(encounter_ids)}")
        if dependencies:
            raise ValueError(
                f"Sheet '{sheet_id}' cannot be deleted while referenced by "
                + "; ".join(dependencies)
                + "."
            )

        path = state_sync_service.join_path("sheets", sheet_id)
        _, op = state_sync_service.remove_mutation(state, path)
        ops = [op]
        if sheet_id in state.player_kill_visibility:
            _, visibility_op = state_sync_service.remove_mutation(
                state,
                state_sync_service.join_path(
                    "player_kill_visibility", sheet_id
                ),
            )
            ops.append(visibility_op)
        return None, ops

    await state_sync_service.apply_mutation(mutation, request_id=request_id)


async def create_sheet(request: CreateEntity) -> None:
    payload = SheetDefinitionPayload.model_validate(request.entity)
    await _create_sheet(payload, request_id=request.request_id)


async def update_sheet(request: UpdateEntity) -> None:
    def mutation(state: State) -> tuple[SheetDefinitionPayload, list]:
        sheets = _sheets_state(state)
        current = sheets.get(request.entity_id)
        if current is None:
            raise ValueError(f"Sheet '{request.entity_id}' does not exist.")

        merged = _merge_entity(
            asdict(current) if is_dataclass(current) else current,
            request.entity_partial,
        )
        payload = SheetDefinitionPayload.model_validate(merged)
        if payload.id != request.entity_id:
            raise ValueError("Sheet ID cannot be changed.")
        return payload, []

    payload = await state_sync_service.apply_mutation(
        mutation,
        request_id=request.request_id,
    )
    await _update_sheet(
        request.entity_id,
        payload,
        request_id=request.request_id,
    )


async def delete_sheet(request: DeleteEntity) -> None:
    await _delete_sheet(request.entity_id, request_id=request.request_id)


async def create_typed_sheet(request: CreateSheet) -> None:
    await _create_sheet(request.sheet, request_id=request.request_id)


async def update_typed_sheet(request: UpdateSheet) -> None:
    await _update_sheet(
        request.sheet_id,
        request.sheet,
        request_id=request.request_id,
    )


async def delete_typed_sheet(request: DeleteSheet) -> None:
    await _delete_sheet(request.sheet_id, request_id=request.request_id)


async def delete_instanced_sheet(request: DeleteInstancedSheet) -> None:
    def mutation(state: State) -> tuple[None, list]:
        if request.instance_id not in state.instanced_sheets:
            raise ValueError(f"Instanced sheet '{request.instance_id}' does not exist.")

        ops: list = []
        removed_application_ids: set[str] = set()

        for party_id, party in sorted(state.parties.items()):
            if request.instance_id not in party.member_instance_ids:
                continue
            updated_members = [
                instance_id
                for instance_id in party.member_instance_ids
                if instance_id != request.instance_id
            ]
            ops.append(
                state_sync_service.set_mutation(
                    state,
                    state_sync_service.join_path(
                        "parties", party_id, "member_instance_ids"
                    ),
                    updated_members,
                )
            )

        for application_id, active_condition in sorted(
            list(state.active_conditions.items())
        ):
            if active_condition.instance_id != request.instance_id:
                continue
            removed_application_ids.add(application_id)
            _, remove_op = state_sync_service.remove_mutation(
                state,
                state_sync_service.join_path("active_conditions", application_id),
            )
            ops.append(remove_op)

        for application_id, application in sorted(
            list(state.standalone_effect_applications.items())
        ):
            if application.instance_id != request.instance_id:
                continue
            removed_application_ids.add(application_id)
            _, remove_op = state_sync_service.remove_mutation(
                state,
                state_sync_service.join_path(
                    "standalone_effect_applications",
                    application_id,
                ),
            )
            ops.append(remove_op)

        for augmentation_id, augmentation in sorted(list(state.augmentations.items())):
            source_application_id = augmentation.source.application_id
            if (
                augmentation.applied_target_id != request.instance_id
                and source_application_id not in removed_application_ids
            ):
                continue
            _, remove_op = state_sync_service.remove_mutation(
                state,
                state_sync_service.join_path("augmentations", augmentation_id),
            )
            ops.append(remove_op)

        for code, access_code in sorted(list(state.sheet_access_codes.items())):
            if access_code.instance_id != request.instance_id:
                continue
            del state.sheet_access_codes[code]

        for item_id, item in sorted(list(state.items.items())):
            if (
                item.approval_status != "pending"
                or item.submitted_by_instance_id != request.instance_id
            ):
                continue
            _, remove_item_op = state_sync_service.remove_mutation(
                state,
                state_sync_service.join_path("items", item_id),
            )
            ops.append(remove_item_op)

        for transaction_id, transaction in sorted(
            list(state.contribution_point_transactions.items())
        ):
            if transaction.instance_id != request.instance_id:
                continue
            _, remove_transaction_op = state_sync_service.remove_mutation(
                state,
                state_sync_service.join_path(
                    "contribution_point_transactions", transaction_id
                ),
            )
            ops.append(remove_transaction_op)

        _, remove_instance_op = state_sync_service.remove_mutation(
            state,
            state_sync_service.join_path("instanced_sheets", request.instance_id),
        )
        ops.append(remove_instance_op)
        return None, ops

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def set_sheet_notes(request: SetSheetNotes) -> None:
    def mutation(state: State) -> tuple[None, list]:
        if request.sheet_id not in state.sheets:
            raise ValueError(f"Sheet '{request.sheet_id}' does not exist.")

        path = state_sync_service.join_path("sheets", request.sheet_id, "notes")
        op = state_sync_service.set_mutation(state, path, request.notes)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def set_instanced_sheet_notes(request: SetInstancedSheetNotes) -> None:
    def mutation(state: State) -> tuple[None, list]:
        if request.instance_id not in state.instanced_sheets:
            raise ValueError(f"Instance '{request.instance_id}' does not exist.")

        path = state_sync_service.join_path(
            "instanced_sheets",
            request.instance_id,
            "notes",
        )
        op = state_sync_service.set_mutation(state, path, request.notes)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def set_instanced_sheet_profile(request: SetInstancedSheetProfile) -> None:
    profile = CharacterProfile.from_dict(request.profile.model_dump(mode="json"))

    def mutation(state: State) -> tuple[None, list]:
        if request.instance_id not in state.instanced_sheets:
            raise ValueError(f"Instance '{request.instance_id}' does not exist.")

        path = state_sync_service.join_path(
            "instanced_sheets",
            request.instance_id,
            "profile",
        )
        op = state_sync_service.set_mutation(state, path, profile)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


def _normalize_resource_value(resource: str, value: float) -> int | float:
    if value < 0:
        raise ValueError("Current resource value cannot be below zero.")
    if resource == "mana":
        if not float(value).is_integer():
            raise ValueError("Mana must be a whole number.")
        return int(value)
    return value


async def set_instanced_sheet_resource(
    request: SetInstancedSheetResource,
) -> None:
    value = _normalize_resource_value(request.resource, request.value)

    def mutation(state: State) -> tuple[None, list]:
        if request.instance_id not in state.instanced_sheets:
            raise ValueError(f"Instance '{request.instance_id}' does not exist.")

        path = state_sync_service.join_path(
            "instanced_sheets",
            request.instance_id,
            request.resource,
        )
        op = state_sync_service.set_mutation(state, path, value)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def adjust_instanced_sheet_resource(
    request: AdjustInstancedSheetResource,
) -> None:
    def mutation(state: State) -> tuple[None, list]:
        instance = state.instanced_sheets.get(request.instance_id)
        if instance is None:
            raise ValueError(f"Instance '{request.instance_id}' does not exist.")

        current = getattr(instance, request.resource)
        next_value = _normalize_resource_value(
            request.resource,
            current + request.delta,
        )
        path = state_sync_service.join_path(
            "instanced_sheets",
            request.instance_id,
            request.resource,
        )
        op = state_sync_service.set_mutation(state, path, next_value)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def instantiate_sheet(
    request: CreateInstancedSheet,
) -> SheetAccessCodes | None:
    def mutation(state: State) -> tuple[None, list]:
        template = state.sheets.get(request.parent_sheet_id)
        if template is None:
            raise ValueError(f"Sheet '{request.parent_sheet_id}' does not exist.")
        if request.instance_id in state.instanced_sheets:
            raise ValueError(f"Instance '{request.instance_id}' already exists.")

        instance = build_instanced_sheet_from_template(
            template,
            parent_sheet_id=request.parent_sheet_id,
            notes=request.notes,
            health=request.health,
            mana=request.mana,
            resistances=(
                _build_resistances(request.resistances)
                if request.resistances is not None
                else None
            ),
        )

        path = state_sync_service.join_path("instanced_sheets", request.instance_id)
        op = state_sync_service.add_mutation(state, path, instance)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)

    if not request.generate_access_code:
        return None

    return await sheet_access_service.generate_sheet_access_code(
        sheet_id=request.parent_sheet_id,
        instance_id=request.instance_id,
        request_id=request.request_id,
    )


async def create_sheet_from_instance(request: CreateSheetFromInstance) -> None:
    def mutation(state: State) -> tuple[None, list]:
        if request.sheet_id in state.sheets:
            raise ValueError(f"Sheet '{request.sheet_id}' already exists.")
        instance = state.instanced_sheets.get(request.instance_id)
        if instance is None:
            raise ValueError(f"Instance '{request.instance_id}' does not exist.")
        parent = state.sheets.get(instance.parent_id)
        if parent is None:
            raise ValueError(
                f"Instance '{request.instance_id}' references missing sheet "
                f"'{instance.parent_id}'."
            )

        payload = _sheet_payload_from_instance(
            sheet_id=request.sheet_id,
            name=request.name,
            notes=instance.notes if request.notes is None else request.notes,
            dm_only=parent.dm_only if request.dm_only is None else request.dm_only,
            instance=instance,
        )
        _validate_sheet_references(payload, state)
        sheet = _build_sheet(payload)
        _validate_sheet_attributes(sheet, state)

        path = state_sync_service.join_path("sheets", sheet.id)
        op = state_sync_service.add_mutation(state, path, sheet)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def attach_sheet_action(request: CreateSheetActionBridge) -> None:
    bridge = _build_sheet_action_bridge(request.bridge)

    def mutation(state: State) -> tuple[None, list]:
        sheet = state.sheets.get(request.sheet_id)
        if sheet is None:
            raise ValueError(f"Sheet '{request.sheet_id}' does not exist.")
        if request.bridge.action_id not in state.actions:
            raise ValueError(f"Action '{request.bridge.action_id}' does not exist.")
        if request.bridge.relationship_id in sheet.actions:
            raise ValueError(
                f"Sheet action bridge '{request.bridge.relationship_id}' already exists."
            )

        path = state_sync_service.join_path(
            "sheets",
            request.sheet_id,
            "actions",
            request.bridge.relationship_id,
        )
        op = state_sync_service.add_mutation(state, path, bridge)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def relink_sheet_action(request: UpdateSheetActionBridge) -> None:
    if request.bridge.relationship_id != request.relationship_id:
        raise ValueError("Sheet action bridge ID cannot be changed.")

    bridge = _build_sheet_action_bridge(request.bridge)

    def mutation(state: State) -> tuple[None, list]:
        sheet = state.sheets.get(request.sheet_id)
        if sheet is None:
            raise ValueError(f"Sheet '{request.sheet_id}' does not exist.")
        if request.bridge.action_id not in state.actions:
            raise ValueError(f"Action '{request.bridge.action_id}' does not exist.")
        if request.relationship_id not in sheet.actions:
            raise ValueError(
                f"Sheet action bridge '{request.relationship_id}' does not exist."
            )

        path = state_sync_service.join_path(
            "sheets",
            request.sheet_id,
            "actions",
            request.relationship_id,
        )
        op = state_sync_service.set_mutation(state, path, bridge)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def detach_sheet_action(request: DeleteSheetActionBridge) -> None:
    def mutation(state: State) -> tuple[None, list]:
        sheet = state.sheets.get(request.sheet_id)
        if sheet is None:
            raise ValueError(f"Sheet '{request.sheet_id}' does not exist.")
        if request.relationship_id not in sheet.actions:
            raise ValueError(
                f"Sheet action bridge '{request.relationship_id}' does not exist."
            )

        path = state_sync_service.join_path(
            "sheets",
            request.sheet_id,
            "actions",
            request.relationship_id,
        )
        _, op = state_sync_service.remove_mutation(state, path)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def attach_instanced_sheet_action(
    request: CreateInstancedSheetActionBridge,
) -> None:
    bridge = _build_sheet_action_bridge(request.bridge)

    def mutation(state: State) -> tuple[None, list]:
        instance = state.instanced_sheets.get(request.instance_id)
        if instance is None:
            raise ValueError(f"Instance '{request.instance_id}' does not exist.")
        if request.bridge.action_id not in state.actions:
            raise ValueError(f"Action '{request.bridge.action_id}' does not exist.")
        if request.bridge.relationship_id in instance.actions:
            raise ValueError(
                f"Instance action bridge '{request.bridge.relationship_id}' already exists."
            )

        path = state_sync_service.join_path(
            "instanced_sheets",
            request.instance_id,
            "actions",
            request.bridge.relationship_id,
        )
        op = state_sync_service.add_mutation(state, path, bridge)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def relink_instanced_sheet_action(
    request: UpdateInstancedSheetActionBridge,
) -> None:
    if request.bridge.relationship_id != request.relationship_id:
        raise ValueError("Instance action bridge ID cannot be changed.")

    bridge = _build_sheet_action_bridge(request.bridge)

    def mutation(state: State) -> tuple[None, list]:
        instance = state.instanced_sheets.get(request.instance_id)
        if instance is None:
            raise ValueError(f"Instance '{request.instance_id}' does not exist.")
        if request.bridge.action_id not in state.actions:
            raise ValueError(f"Action '{request.bridge.action_id}' does not exist.")
        if request.relationship_id not in instance.actions:
            raise ValueError(
                f"Instance action bridge '{request.relationship_id}' does not exist."
            )

        path = state_sync_service.join_path(
            "instanced_sheets",
            request.instance_id,
            "actions",
            request.relationship_id,
        )
        op = state_sync_service.set_mutation(state, path, bridge)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def detach_instanced_sheet_action(
    request: DeleteInstancedSheetActionBridge,
) -> None:
    def mutation(state: State) -> tuple[None, list]:
        instance = state.instanced_sheets.get(request.instance_id)
        if instance is None:
            raise ValueError(f"Instance '{request.instance_id}' does not exist.")
        if request.relationship_id not in instance.actions:
            raise ValueError(
                f"Instance action bridge '{request.relationship_id}' does not exist."
            )

        path = state_sync_service.join_path(
            "instanced_sheets",
            request.instance_id,
            "actions",
            request.relationship_id,
        )
        _, op = state_sync_service.remove_mutation(state, path)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def attach_sheet_item(request: CreateSheetItemBridge) -> None:
    bridge = _build_sheet_item_bridge(request.bridge)

    def mutation(state: State) -> tuple[None, list]:
        sheet = state.sheets.get(request.sheet_id)
        if sheet is None:
            raise ValueError(f"Sheet '{request.sheet_id}' does not exist.")
        _validate_item_bridge(request.bridge, state)
        if request.bridge.relationship_id in sheet.items:
            raise ValueError(
                f"Sheet item bridge '{request.bridge.relationship_id}' already exists."
            )
        validate_inventory({**sheet.items, bridge.relationship_id: bridge}, state.items)

        path = state_sync_service.join_path(
            "sheets",
            request.sheet_id,
            "items",
            request.bridge.relationship_id,
        )
        op = state_sync_service.add_mutation(state, path, bridge)
        proficiency_ops = _add_weapon_proficiency_bridge_mutations(
            state,
            sheet_id=request.sheet_id,
            sheet=sheet,
            item_bridge=bridge,
        )
        return None, [op, *proficiency_ops]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def update_attached_sheet_item(request: UpdateSheetItemBridge) -> None:
    if request.bridge.relationship_id != request.relationship_id:
        raise ValueError("Sheet item bridge ID cannot be changed.")

    bridge = _build_sheet_item_bridge(request.bridge)

    def mutation(state: State) -> tuple[None, list]:
        sheet = state.sheets.get(request.sheet_id)
        if sheet is None:
            raise ValueError(f"Sheet '{request.sheet_id}' does not exist.")
        _validate_item_bridge(request.bridge, state)
        if request.relationship_id not in sheet.items:
            raise ValueError(
                f"Sheet item bridge '{request.relationship_id}' does not exist."
            )
        validate_inventory({**sheet.items, request.relationship_id: bridge}, state.items)

        path = state_sync_service.join_path(
            "sheets",
            request.sheet_id,
            "items",
            request.relationship_id,
        )
        op = state_sync_service.set_mutation(state, path, bridge)
        proficiency_ops = _add_weapon_proficiency_bridge_mutations(
            state,
            sheet_id=request.sheet_id,
            sheet=sheet,
            item_bridge=bridge,
        )
        return None, [op, *proficiency_ops]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def detach_sheet_item(request: DeleteSheetItemBridge) -> None:
    def mutation(state: State) -> tuple[None, list]:
        sheet = state.sheets.get(request.sheet_id)
        if sheet is None:
            raise ValueError(f"Sheet '{request.sheet_id}' does not exist.")
        if request.relationship_id not in sheet.items:
            raise ValueError(
                f"Sheet item bridge '{request.relationship_id}' does not exist."
            )
        if any(
            bridge.parent_container_id == request.relationship_id
            for bridge in sheet.items.values()
        ):
            raise ValueError("Empty a storage container before removing it.")

        path = state_sync_service.join_path(
            "sheets",
            request.sheet_id,
            "items",
            request.relationship_id,
        )
        _, op = state_sync_service.remove_mutation(state, path)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def attach_instanced_sheet_item(
    request: CreateInstancedSheetItemBridge,
) -> None:
    bridge = _build_sheet_item_bridge(request.bridge)

    def mutation(state: State) -> tuple[None, list]:
        instance = state.instanced_sheets.get(request.instance_id)
        if instance is None:
            raise ValueError(f"Instance '{request.instance_id}' does not exist.")
        _validate_item_bridge(request.bridge, state)
        if request.bridge.relationship_id in instance.items:
            raise ValueError(
                f"Instance item bridge '{request.bridge.relationship_id}' already exists."
            )
        validate_inventory({**instance.items, bridge.relationship_id: bridge}, state.items)
        path = state_sync_service.join_path(
            "instanced_sheets",
            request.instance_id,
            "items",
            request.bridge.relationship_id,
        )
        return None, [state_sync_service.add_mutation(state, path, bridge)]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def update_instanced_sheet_item(
    request: UpdateInstancedSheetItemBridge,
) -> None:
    if request.bridge.relationship_id != request.relationship_id:
        raise ValueError("Instance item bridge ID cannot be changed.")
    bridge = _build_sheet_item_bridge(request.bridge)

    def mutation(state: State) -> tuple[None, list]:
        instance = state.instanced_sheets.get(request.instance_id)
        if instance is None:
            raise ValueError(f"Instance '{request.instance_id}' does not exist.")
        _validate_item_bridge(request.bridge, state)
        if request.relationship_id not in instance.items:
            raise ValueError(
                f"Instance item bridge '{request.relationship_id}' does not exist."
            )
        validate_inventory({**instance.items, request.relationship_id: bridge}, state.items)
        path = state_sync_service.join_path(
            "instanced_sheets",
            request.instance_id,
            "items",
            request.relationship_id,
        )
        return None, [state_sync_service.set_mutation(state, path, bridge)]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def detach_instanced_sheet_item(
    request: DeleteInstancedSheetItemBridge,
) -> None:
    def mutation(state: State) -> tuple[None, list]:
        instance = state.instanced_sheets.get(request.instance_id)
        if instance is None:
            raise ValueError(f"Instance '{request.instance_id}' does not exist.")
        if request.relationship_id not in instance.items:
            raise ValueError(
                f"Instance item bridge '{request.relationship_id}' does not exist."
            )
        if any(
            bridge.parent_container_id == request.relationship_id
            for bridge in instance.items.values()
        ):
            raise ValueError("Empty a storage container before removing it.")
        path = state_sync_service.join_path(
            "instanced_sheets",
            request.instance_id,
            "items",
            request.relationship_id,
        )
        _, op = state_sync_service.remove_mutation(state, path)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def move_instanced_sheet_item(request: MoveInstancedSheetItem) -> None:
    def mutation(state: State) -> tuple[None, list]:
        instance = state.instanced_sheets.get(request.instance_id)
        if instance is None:
            raise ValueError(f"Instance '{request.instance_id}' does not exist.")
        bridge = instance.items.get(request.relationship_id)
        if bridge is None:
            raise ValueError(
                f"Instance item bridge '{request.relationship_id}' does not exist."
            )
        if bridge.parent_container_id == request.parent_container_id:
            return None, []

        candidate = deepcopy(instance.items)
        candidate_bridge = deepcopy(bridge)
        candidate_bridge.parent_container_id = request.parent_container_id
        candidate[request.relationship_id] = candidate_bridge
        validate_inventory(candidate, state.items)

        path = state_sync_service.join_path(
            "instanced_sheets",
            request.instance_id,
            "items",
            request.relationship_id,
            "parent_container_id",
        )
        op = state_sync_service.set_mutation(
            state,
            path,
            request.parent_container_id,
        )
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def link_sheet_proficiency(
    request: CreateSheetProficiencyBridge,
) -> None:
    bridge = _build_sheet_proficiency_bridge(request.bridge)

    def mutation(state: State) -> tuple[None, list]:
        sheet = state.sheets.get(request.sheet_id)
        if sheet is None:
            raise ValueError(f"Sheet '{request.sheet_id}' does not exist.")
        if request.bridge.relationship_id in sheet.proficiencies:
            raise ValueError(
                "Sheet proficiency bridge "
                f"'{request.bridge.relationship_id}' already exists."
            )
        _validate_proficiency_reference(request.bridge.prof_id, state)

        path = state_sync_service.join_path(
            "sheets",
            request.sheet_id,
            "proficiencies",
            request.bridge.relationship_id,
        )
        op = state_sync_service.add_mutation(state, path, bridge)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def update_linked_sheet_proficiency(
    request: UpdateSheetProficiencyBridge,
) -> None:
    if request.bridge.relationship_id != request.relationship_id:
        raise ValueError("Sheet proficiency bridge ID cannot be changed.")

    bridge = _build_sheet_proficiency_bridge(request.bridge)

    def mutation(state: State) -> tuple[None, list]:
        sheet = state.sheets.get(request.sheet_id)
        if sheet is None:
            raise ValueError(f"Sheet '{request.sheet_id}' does not exist.")
        if request.relationship_id not in sheet.proficiencies:
            raise ValueError(
                f"Sheet proficiency bridge '{request.relationship_id}' does not exist."
            )
        _validate_proficiency_reference(request.bridge.prof_id, state)

        path = state_sync_service.join_path(
            "sheets",
            request.sheet_id,
            "proficiencies",
            request.relationship_id,
        )
        op = state_sync_service.set_mutation(state, path, bridge)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def unlink_sheet_proficiency(
    request: DeleteSheetProficiencyBridge,
) -> None:
    def mutation(state: State) -> tuple[None, list]:
        sheet = state.sheets.get(request.sheet_id)
        if sheet is None:
            raise ValueError(f"Sheet '{request.sheet_id}' does not exist.")
        if request.relationship_id not in sheet.proficiencies:
            raise ValueError(
                f"Sheet proficiency bridge '{request.relationship_id}' does not exist."
            )

        path = state_sync_service.join_path(
            "sheets",
            request.sheet_id,
            "proficiencies",
            request.relationship_id,
        )
        _, op = state_sync_service.remove_mutation(state, path)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def link_instanced_sheet_proficiency(
    request: CreateInstancedSheetProficiencyBridge,
) -> None:
    bridge = _build_sheet_proficiency_bridge(request.bridge)

    def mutation(state: State) -> tuple[None, list]:
        instance = state.instanced_sheets.get(request.instance_id)
        if instance is None:
            raise ValueError(f"Instance '{request.instance_id}' does not exist.")
        if request.bridge.relationship_id in instance.proficiencies:
            raise ValueError(
                "Instance proficiency bridge "
                f"'{request.bridge.relationship_id}' already exists."
            )
        _validate_proficiency_reference(request.bridge.prof_id, state)

        path = state_sync_service.join_path(
            "instanced_sheets",
            request.instance_id,
            "proficiencies",
            request.bridge.relationship_id,
        )
        op = state_sync_service.add_mutation(state, path, bridge)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def update_linked_instanced_sheet_proficiency(
    request: UpdateInstancedSheetProficiencyBridge,
) -> None:
    if request.bridge.relationship_id != request.relationship_id:
        raise ValueError("Instance proficiency bridge ID cannot be changed.")

    bridge = _build_sheet_proficiency_bridge(request.bridge)

    def mutation(state: State) -> tuple[None, list]:
        instance = state.instanced_sheets.get(request.instance_id)
        if instance is None:
            raise ValueError(f"Instance '{request.instance_id}' does not exist.")
        if request.relationship_id not in instance.proficiencies:
            raise ValueError(
                f"Instance proficiency bridge '{request.relationship_id}' does not exist."
            )
        _validate_proficiency_reference(request.bridge.prof_id, state)

        path = state_sync_service.join_path(
            "instanced_sheets",
            request.instance_id,
            "proficiencies",
            request.relationship_id,
        )
        op = state_sync_service.set_mutation(state, path, bridge)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def unlink_instanced_sheet_proficiency(
    request: DeleteInstancedSheetProficiencyBridge,
) -> None:
    def mutation(state: State) -> tuple[None, list]:
        instance = state.instanced_sheets.get(request.instance_id)
        if instance is None:
            raise ValueError(f"Instance '{request.instance_id}' does not exist.")
        if request.relationship_id not in instance.proficiencies:
            raise ValueError(
                f"Instance proficiency bridge '{request.relationship_id}' does not exist."
            )

        path = state_sync_service.join_path(
            "instanced_sheets",
            request.instance_id,
            "proficiencies",
            request.relationship_id,
        )
        _, op = state_sync_service.remove_mutation(state, path)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)
