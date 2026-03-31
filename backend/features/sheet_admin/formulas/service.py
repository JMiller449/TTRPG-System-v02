from __future__ import annotations

from copy import deepcopy
from dataclasses import asdict, is_dataclass
from typing import Literal

from backend.features.sheet_admin.formulas.schema import FormulaDefinitionPayload, FormulaPayload
from backend.features.sheet_admin.shared.schema import (
    CreateEntity,
    DeleteEntity,
    UpdateEntity,
)
from backend.features.state_sync.service import state_sync_service
from backend.state.models.formula import Formula, FormulaAliases, FormulaDefinition
from backend.state.models.state import State


def build_formula(payload: FormulaPayload) -> Formula:
    aliases = None
    if payload.aliases is not None:
        aliases = [
            FormulaAliases(name=alias.name, path=list(alias.path))
            for alias in payload.aliases
        ]
    return Formula(aliases=aliases, text=payload.text)


def _build_formula_definition(payload: FormulaDefinitionPayload) -> FormulaDefinition:
    return FormulaDefinition(id=payload.id, formula=build_formula(payload.formula))


def _formulas_state(state: State) -> dict[str, dict]:
    return state.formulas


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
        await create_formula(request)
        return
    if isinstance(request, UpdateEntity):
        await update_formula(request)
        return
    await delete_formula(request)


async def create_formula(request: CreateEntity) -> None:
    payload = FormulaDefinitionPayload.model_validate(request.entity)
    formula = _build_formula_definition(payload)

    def mutation(state: State) -> tuple[None, list]:
        formulas = _formulas_state(state)
        if payload.id in formulas:
            raise ValueError(f"Formula '{payload.id}' already exists.")
        path = state_sync_service.join_path("formulas", payload.id)
        op = state_sync_service.add_mutation(state, path, formula)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def update_formula(request: UpdateEntity) -> None:
    def mutation(state: State) -> tuple[None, list]:
        formulas = _formulas_state(state)
        current = formulas.get(request.entity_id)
        if current is None:
            raise ValueError(f"Formula '{request.entity_id}' does not exist.")

        merged = _merge_entity(asdict(current) if is_dataclass(current) else current, request.entity_partial)
        payload = FormulaDefinitionPayload.model_validate(merged)
        if payload.id != request.entity_id:
            raise ValueError("Formula ID cannot be changed.")

        formula = _build_formula_definition(payload)
        path = state_sync_service.join_path("formulas", request.entity_id)
        op = state_sync_service.set_mutation(state, path, formula)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def delete_formula(request: DeleteEntity) -> None:
    def mutation(state: State) -> tuple[None, list]:
        formulas = _formulas_state(state)
        if request.entity_id not in formulas:
            raise ValueError(f"Formula '{request.entity_id}' does not exist.")

        path = state_sync_service.join_path("formulas", request.entity_id)
        _, op = state_sync_service.remove_mutation(state, path)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)
