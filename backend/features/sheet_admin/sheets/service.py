from __future__ import annotations

from copy import deepcopy
from dataclasses import asdict, is_dataclass

from backend.features.sheet_admin.formulas.service import (
    build_formula,
    validate_formula_payload_paths,
)
from backend.features.sheet_admin.shared.schema import (
    CreateEntity,
    DeleteEntity,
    UpdateEntity,
)
from backend.features.sheet_admin.sheets.schema import (
    ActionBridgePayload,
    AdjustInstancedSheetResource,
    CreateInstancedSheet,
    CreateSheetActionBridge,
    CreateSheetItemBridge,
    CreateSheetProficiencyBridge,
    CreateSheet,
    DeleteSheetActionBridge,
    DeleteSheetItemBridge,
    DeleteSheetProficiencyBridge,
    DeleteSheet,
    ItemBridgePayload,
    ProficiencyBridgePayload,
    ResistancesPayload,
    SetInstancedSheetNotes,
    SetInstancedSheetResource,
    SetSheetNotes,
    SheetDefinitionPayload,
    SheetActionBridgePayload,
    StatsPayload,
    UpdateSheetActionBridge,
    UpdateSheetItemBridge,
    UpdateSheetProficiencyBridge,
    UpdateSheet,
)
from backend.features.sheet_access import service as sheet_access_service
from backend.features.sheet_access.schema import SheetAccessCodes
from backend.features.state_sync.service import state_sync_service
from backend.state.models.action import Action, SendMessageStep
from backend.state.models.formula import Formula, FormulaAliases
from backend.state.models.item import ItemBridge
from backend.state.models.proficiency import ProficiencyBridge
from backend.state.models.resistance import Resistances
from backend.state.models.shared import Bridge
from backend.state.models.sheet import InstancedSheet, Sheet, SheetSlayedBridge
from backend.state.models.stat import Stats
from backend.state.models.state import State

_BASELINE_CHECK_STATS: tuple[tuple[str, str], ...] = (
    ("strength", "Strength"),
    ("dexterity", "Dexterity"),
    ("constitution", "Constitution"),
    ("perception", "Perception"),
    ("arcane", "Arcane"),
    ("will", "Will"),
)

_DEFAULT_ACTION_PRESETS: tuple[tuple[str, str, str], ...] = (
    ("attack", "Attack", "strength"),
    ("dodge", "Dodge", "dexterity"),
    ("parry", "Parry", "dexterity"),
    ("block", "Block", "constitution"),
)


def _build_stats(payload: StatsPayload) -> Stats:
    _validate_stats_formula_paths(payload)
    return Stats(
        strength=payload.strength,
        dexterity=payload.dexterity,
        constitution=payload.constitution,
        perception=payload.perception,
        arcane=payload.arcane,
        will=payload.will,
        lifting=build_formula(payload.lifting),
        carry_weight=build_formula(payload.carry_weight),
        acrobatics=build_formula(payload.acrobatics),
        stamina=build_formula(payload.stamina),
        reaction_time=build_formula(payload.reaction_time),
        health=build_formula(payload.health),
        endurance=build_formula(payload.endurance),
        pain_tolerance=build_formula(payload.pain_tolerance),
        sight_distance=build_formula(payload.sight_distance),
        intuition=build_formula(payload.intuition),
        registration=build_formula(payload.registration),
        mana=build_formula(payload.mana),
        control=build_formula(payload.control),
        sensitivity=build_formula(payload.sensitivity),
        charisma=build_formula(payload.charisma),
        mental_fortitude=build_formula(payload.mental_fortitude),
        courage=build_formula(payload.courage),
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


def _build_sheet(payload: SheetDefinitionPayload) -> Sheet:
    return Sheet(
        id=payload.id,
        name=payload.name,
        notes=payload.notes,
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
                active=bridge.active,
                item_id=bridge.item_id,
            )
            for key, bridge in payload.items.items()
        },
        stats=_build_stats(payload.stats),
        resistances=_build_resistances(payload.resistances),
        slayed_record={
            key: SheetSlayedBridge(
                sheet_id=bridge.sheet_id,
                count=bridge.count,
            )
            for key, bridge in payload.slayed_record.items()
        },
        actions={
            key: Bridge(
                relationship_id=bridge.relationship_id,
                entry_id=bridge.entry_id,
            )
            for key, bridge in payload.actions.items()
        },
    )


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
        notes="Default baseline sheet check. Emits a Roll20 d100 stat check.",
        steps=[
            SendMessageStep(
                step_id="roll",
                message=Formula(
                    aliases=[
                        FormulaAliases(
                            name=stat_name,
                            path=["stats", stat_name],
                        )
                    ],
                    text=f"{label} Check: /r (1d100 / 100) * @{stat_name}",
                ),
            )
        ],
    )


def _baseline_check_actions() -> dict[str, Action]:
    return {
        _baseline_check_action_id(stat_name): _build_baseline_check_action(
            stat_name,
            label,
        )
        for stat_name, label in _BASELINE_CHECK_STATS
    }


def _build_default_action_preset(
    action_id: str,
    label: str,
    stat_name: str,
) -> Action:
    return Action(
        id=action_id,
        name=label,
        notes=(
            "Default editable action preset. This is intentionally authored as a "
            "normal action so sheets can customize, replace, or remove it."
        ),
        steps=[
            SendMessageStep(
                step_id="roll",
                message=Formula(
                    aliases=[
                        FormulaAliases(
                            name=stat_name,
                            path=["stats", stat_name],
                        )
                    ],
                    text=f"{label}: /r (1d100 / 100) * @{stat_name}",
                ),
            )
        ],
    )


def _default_action_presets() -> dict[str, Action]:
    return {
        action_id: _build_default_action_preset(
            action_id,
            label,
            stat_name,
        )
        for action_id, label, stat_name in _DEFAULT_ACTION_PRESETS
    }


def _default_sheet_actions() -> dict[str, Action]:
    return {
        **_baseline_check_actions(),
        **_default_action_presets(),
    }


def _with_default_action_bridges(
    payload: SheetDefinitionPayload,
) -> SheetDefinitionPayload:
    actions = dict(payload.actions)
    for action_id in _default_sheet_actions():
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
    for action_id, action in _default_sheet_actions().items():
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


def _validate_stats_formula_paths(payload: StatsPayload) -> None:
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
        validate_formula_payload_paths(formula)


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
        if bridge.item_id not in state.items:
            raise ValueError(f"Item '{bridge.item_id}' does not exist.")

    for key, bridge in payload.proficiencies.items():
        _validate_relationship_key(
            relationship_kind="Sheet proficiency bridge",
            key=key,
            relationship_id=bridge.relationship_id,
        )

    valid_sheet_ids = set(state.sheets) | {payload.id}
    for key, bridge in payload.slayed_record.items():
        if key != bridge.sheet_id:
            raise ValueError(
                f"Sheet slayed record key '{key}' must match sheet_id "
                f"'{bridge.sheet_id}'."
            )
        if bridge.sheet_id not in valid_sheet_ids:
            raise ValueError(f"Sheet '{bridge.sheet_id}' does not exist.")


def _build_sheet_action_bridge(payload: SheetActionBridgePayload) -> Bridge:
    return Bridge(
        relationship_id=payload.relationship_id,
        entry_id=payload.action_id,
    )


def _build_sheet_item_bridge(payload: ItemBridgePayload) -> ItemBridge:
    return ItemBridge(
        relationship_id=payload.relationship_id,
        count=payload.count,
        active=payload.active,
        item_id=payload.item_id,
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
    default_actions = _default_sheet_actions()

    def mutation(state: State) -> tuple[None, list]:
        sheets = _sheets_state(state)
        if payload.id in sheets:
            raise ValueError(f"Sheet '{payload.id}' already exists.")
        _validate_sheet_references(
            payload,
            state,
            extra_action_ids=set(default_actions),
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
    if payload.id != sheet_id:
        raise ValueError("Sheet ID cannot be changed.")

    def mutation(state: State) -> tuple[None, list]:
        sheets = _sheets_state(state)
        if sheet_id not in sheets:
            raise ValueError(f"Sheet '{sheet_id}' does not exist.")

        _validate_sheet_references(payload, state)
        sheet = _build_sheet(payload)
        path = state_sync_service.join_path("sheets", sheet_id)
        op = state_sync_service.set_mutation(state, path, sheet)
        return None, [op]

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

        path = state_sync_service.join_path("sheets", sheet_id)
        _, op = state_sync_service.remove_mutation(state, path)
        return None, [op]

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


async def create_instanced_sheet(
    request: CreateInstancedSheet,
) -> SheetAccessCodes | None:
    instance = InstancedSheet(
        parent_id=request.parent_sheet_id,
        notes=request.notes,
        health=request.health,
        mana=request.mana,
        resistances=_build_resistances(request.resistances),
        augments={},
    )

    def mutation(state: State) -> tuple[None, list]:
        if request.parent_sheet_id not in state.sheets:
            raise ValueError(f"Sheet '{request.parent_sheet_id}' does not exist.")
        if request.instance_id in state.instanced_sheets:
            raise ValueError(f"Instance '{request.instance_id}' already exists.")

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


async def create_sheet_action_bridge(request: CreateSheetActionBridge) -> None:
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


async def update_sheet_action_bridge(request: UpdateSheetActionBridge) -> None:
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


async def delete_sheet_action_bridge(request: DeleteSheetActionBridge) -> None:
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


async def create_sheet_item_bridge(request: CreateSheetItemBridge) -> None:
    bridge = _build_sheet_item_bridge(request.bridge)

    def mutation(state: State) -> tuple[None, list]:
        sheet = state.sheets.get(request.sheet_id)
        if sheet is None:
            raise ValueError(f"Sheet '{request.sheet_id}' does not exist.")
        if request.bridge.item_id not in state.items:
            raise ValueError(f"Item '{request.bridge.item_id}' does not exist.")
        if request.bridge.relationship_id in sheet.items:
            raise ValueError(
                f"Sheet item bridge '{request.bridge.relationship_id}' already exists."
            )

        path = state_sync_service.join_path(
            "sheets",
            request.sheet_id,
            "items",
            request.bridge.relationship_id,
        )
        op = state_sync_service.add_mutation(state, path, bridge)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def update_sheet_item_bridge(request: UpdateSheetItemBridge) -> None:
    if request.bridge.relationship_id != request.relationship_id:
        raise ValueError("Sheet item bridge ID cannot be changed.")

    bridge = _build_sheet_item_bridge(request.bridge)

    def mutation(state: State) -> tuple[None, list]:
        sheet = state.sheets.get(request.sheet_id)
        if sheet is None:
            raise ValueError(f"Sheet '{request.sheet_id}' does not exist.")
        if request.bridge.item_id not in state.items:
            raise ValueError(f"Item '{request.bridge.item_id}' does not exist.")
        if request.relationship_id not in sheet.items:
            raise ValueError(
                f"Sheet item bridge '{request.relationship_id}' does not exist."
            )

        path = state_sync_service.join_path(
            "sheets",
            request.sheet_id,
            "items",
            request.relationship_id,
        )
        op = state_sync_service.set_mutation(state, path, bridge)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def delete_sheet_item_bridge(request: DeleteSheetItemBridge) -> None:
    def mutation(state: State) -> tuple[None, list]:
        sheet = state.sheets.get(request.sheet_id)
        if sheet is None:
            raise ValueError(f"Sheet '{request.sheet_id}' does not exist.")
        if request.relationship_id not in sheet.items:
            raise ValueError(
                f"Sheet item bridge '{request.relationship_id}' does not exist."
            )

        path = state_sync_service.join_path(
            "sheets",
            request.sheet_id,
            "items",
            request.relationship_id,
        )
        _, op = state_sync_service.remove_mutation(state, path)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def create_sheet_proficiency_bridge(
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

        path = state_sync_service.join_path(
            "sheets",
            request.sheet_id,
            "proficiencies",
            request.bridge.relationship_id,
        )
        op = state_sync_service.add_mutation(state, path, bridge)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def update_sheet_proficiency_bridge(
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

        path = state_sync_service.join_path(
            "sheets",
            request.sheet_id,
            "proficiencies",
            request.relationship_id,
        )
        op = state_sync_service.set_mutation(state, path, bridge)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def delete_sheet_proficiency_bridge(
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
