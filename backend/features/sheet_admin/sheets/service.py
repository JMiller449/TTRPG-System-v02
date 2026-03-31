from __future__ import annotations

from copy import deepcopy
from dataclasses import asdict, is_dataclass
from typing import Literal

from backend.features.sheet_admin.formulas.service import build_formula
from backend.features.sheet_admin.shared.schema import (
    CreateEntity,
    DeleteEntity,
    UpdateEntity,
)
from backend.features.state_sync.service import state_sync_service
from backend.features.sheet_admin.sheets.schema import SheetDefinitionPayload, StatsPayload
from backend.state.models.item import ItemBridge
from backend.state.models.proficiency import ProficiencyBridge
from backend.state.models.sheet import Sheet, SheetSlayedBridge
from backend.state.models.state import State
from backend.state.models.shared import Bridge
from backend.state.models.stat import Stats


def _build_stats(payload: StatsPayload) -> Stats:
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


def _build_sheet(payload: SheetDefinitionPayload) -> Sheet:
    return Sheet(
        id=payload.id,
        name=payload.name,
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


async def create_sheet(request: CreateEntity) -> None:
    payload = SheetDefinitionPayload.model_validate(request.entity)
    sheet = _build_sheet(payload)

    def mutation(state: State) -> tuple[None, list]:
        sheets = _sheets_state(state)
        if payload.id in sheets:
            raise ValueError(f"Sheet '{payload.id}' already exists.")
        path = state_sync_service.join_path("sheets", payload.id)
        op = state_sync_service.add_mutation(state, path, sheet)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def update_sheet(request: UpdateEntity) -> None:
    def mutation(state: State) -> tuple[None, list]:
        sheets = _sheets_state(state)
        current = sheets.get(request.entity_id)
        if current is None:
            raise ValueError(f"Sheet '{request.entity_id}' does not exist.")

        merged = _merge_entity(asdict(current) if is_dataclass(current) else current, request.entity_partial)
        payload = SheetDefinitionPayload.model_validate(merged)
        if payload.id != request.entity_id:
            raise ValueError("Sheet ID cannot be changed.")

        sheet = _build_sheet(payload)
        path = state_sync_service.join_path("sheets", request.entity_id)
        op = state_sync_service.set_mutation(state, path, sheet)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def delete_sheet(request: DeleteEntity) -> None:
    def mutation(state: State) -> tuple[None, list]:
        sheets = _sheets_state(state)
        if request.entity_id not in sheets:
            raise ValueError(f"Sheet '{request.entity_id}' does not exist.")

        path = state_sync_service.join_path("sheets", request.entity_id)
        _, op = state_sync_service.remove_mutation(state, path)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)
