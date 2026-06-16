from __future__ import annotations

from copy import deepcopy
from dataclasses import asdict, is_dataclass

from backend.features.sheet_admin.formulas.schema import (
    CreateFormula,
    DeleteFormula,
    FormulaDefinitionPayload,
    FormulaPayload,
    UpdateFormula,
)
from backend.features.sheet_admin.shared.schema import (
    CreateEntity,
    DeleteEntity,
    UpdateEntity,
)
from backend.features.state_sync.service import state_sync_service
from backend.features.variable_registry import service as variable_registry_service
from backend.state.models.formula import Formula, FormulaAliases, FormulaDefinition
from backend.state.models.state import State


def _format_path(path: list[str]) -> str:
    return ".".join(path)


def _valid_formula_paths() -> set[tuple[str, ...]]:
    registry = variable_registry_service.build_action_formula_authoring_metadata()
    return {
        tuple(variable.path)
        for variable in registry.variables
        if variable.formula_reference_allowed
    }


def validate_formula_payload_paths(formula: FormulaPayload) -> None:
    valid_paths = _valid_formula_paths()
    for alias in formula.aliases or []:
        alias_path = tuple(alias.path)
        if alias_path not in valid_paths:
            raise ValueError(
                "Formula alias "
                f"'{alias.name}' references unsupported path "
                f"'{_format_path(alias.path)}'."
            )


def build_formula(payload: FormulaPayload) -> Formula:
    validate_formula_payload_paths(payload)
    aliases = None
    if payload.aliases is not None:
        aliases = [
            FormulaAliases(name=alias.name, path=list(alias.path))
            for alias in payload.aliases
        ]
    return Formula(aliases=aliases, text=payload.text)


def _build_formula_definition(payload: FormulaDefinitionPayload) -> FormulaDefinition:
    validate_formula_payload_paths(payload.formula)
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


async def _create_formula(
    payload: FormulaDefinitionPayload,
    *,
    request_id: str | None = None,
) -> None:
    formula = _build_formula_definition(payload)

    def mutation(state: State) -> tuple[None, list]:
        formulas = _formulas_state(state)
        if payload.id in formulas:
            raise ValueError(f"Formula '{payload.id}' already exists.")
        path = state_sync_service.join_path("formulas", payload.id)
        op = state_sync_service.add_mutation(state, path, formula)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request_id)


async def _update_formula(
    formula_id: str,
    payload: FormulaDefinitionPayload,
    *,
    request_id: str | None = None,
) -> None:
    if payload.id != formula_id:
        raise ValueError("Formula ID cannot be changed.")

    formula = _build_formula_definition(payload)

    def mutation(state: State) -> tuple[None, list]:
        formulas = _formulas_state(state)
        if formula_id not in formulas:
            raise ValueError(f"Formula '{formula_id}' does not exist.")

        path = state_sync_service.join_path("formulas", formula_id)
        op = state_sync_service.set_mutation(state, path, formula)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request_id)


async def _delete_formula(
    formula_id: str,
    *,
    request_id: str | None = None,
) -> None:
    def mutation(state: State) -> tuple[None, list]:
        formulas = _formulas_state(state)
        if formula_id not in formulas:
            raise ValueError(f"Formula '{formula_id}' does not exist.")

        path = state_sync_service.join_path("formulas", formula_id)
        _, op = state_sync_service.remove_mutation(state, path)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request_id)


async def create_formula(request: CreateEntity) -> None:
    payload = FormulaDefinitionPayload.model_validate(request.entity)
    await _create_formula(payload, request_id=request.request_id)


async def update_formula(request: UpdateEntity) -> None:
    def mutation(state: State) -> tuple[FormulaDefinitionPayload, list]:
        formulas = _formulas_state(state)
        current = formulas.get(request.entity_id)
        if current is None:
            raise ValueError(f"Formula '{request.entity_id}' does not exist.")

        merged = _merge_entity(
            asdict(current) if is_dataclass(current) else current,
            request.entity_partial,
        )
        payload = FormulaDefinitionPayload.model_validate(merged)
        if payload.id != request.entity_id:
            raise ValueError("Formula ID cannot be changed.")
        return payload, []

    payload = await state_sync_service.apply_mutation(
        mutation,
        request_id=request.request_id,
    )
    await _update_formula(
        request.entity_id,
        payload,
        request_id=request.request_id,
    )


async def delete_formula(request: DeleteEntity) -> None:
    await _delete_formula(request.entity_id, request_id=request.request_id)


async def create_typed_formula(request: CreateFormula) -> None:
    await _create_formula(request.formula, request_id=request.request_id)


async def update_typed_formula(request: UpdateFormula) -> None:
    await _update_formula(
        request.formula_id,
        request.formula,
        request_id=request.request_id,
    )


async def delete_typed_formula(request: DeleteFormula) -> None:
    await _delete_formula(request.formula_id, request_id=request.request_id)
