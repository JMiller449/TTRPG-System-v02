from __future__ import annotations

from copy import deepcopy

from backend.features.attributes.service import validate_and_evaluate_sheet_attributes
from backend.features.sheet_admin.formulas.service import build_formula
from backend.features.sheet_admin.stats.schema import (
    SetInstancedSheetBaseStat,
    SetSheetBaseStat,
    SetSheetFormulaStat,
    SetSheetResistances,
)
from backend.features.variable_registry import service as variable_registry_service
from backend.features.state_sync.service import state_sync_service
from backend.state.models.resistance import Resistances
from backend.state.models.state import State


async def set_base_stat(request: SetSheetBaseStat) -> None:
    def mutation(state: State) -> tuple[None, list]:
        if request.sheet_id not in state.sheets:
            raise ValueError(f"Sheet '{request.sheet_id}' does not exist.")

        candidate = deepcopy(state.sheets[request.sheet_id])
        setattr(candidate.stats, request.stat_name, request.value)
        validate_and_evaluate_sheet_attributes(candidate)

        path = state_sync_service.join_path(
            "sheets",
            request.sheet_id,
            "stats",
            request.stat_name,
        )
        op = state_sync_service.set_mutation(state, path, request.value)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def set_instanced_base_stat(request: SetInstancedSheetBaseStat) -> None:
    def mutation(state: State) -> tuple[None, list]:
        instance = state.instanced_sheets.get(request.instance_id)
        if instance is None:
            raise ValueError(f"Instance '{request.instance_id}' does not exist.")
        if instance.stats is None:
            raise ValueError(f"Instance '{request.instance_id}' has no runtime stats.")
        path = state_sync_service.join_path(
            "instanced_sheets",
            request.instance_id,
            "stats",
            request.stat_name,
        )
        op = state_sync_service.set_mutation(state, path, request.value)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def set_formula_stat(request: SetSheetFormulaStat) -> None:
    def mutation(state: State) -> tuple[None, list]:
        if request.sheet_id not in state.sheets:
            raise ValueError(f"Sheet '{request.sheet_id}' does not exist.")

        sheet = state.sheets[request.sheet_id]
        attached_attribute_paths = {
            ("attributes", attribute_id) for attribute_id in sheet.attributes
        }
        sheet_paths = {
            tuple(variable.path)
            for variable in variable_registry_service.build_action_formula_authoring_metadata(
                state=state
            ).variables
            if variable.root == "sheet" and variable.formula_reference_allowed
        } | attached_attribute_paths
        for alias in request.formula.aliases or []:
            alias_path = tuple(alias.path)
            if alias_path not in sheet_paths:
                raise ValueError(
                    f"Sheet formula alias '{alias.name}' references unsupported path "
                    f"'{'.'.join(alias.path)}'."
                )
            if alias.path == ["stats", request.stat_name]:
                raise ValueError(
                    f"Sheet formula stat '{request.stat_name}' cannot reference itself."
                )
        formula = build_formula(
            request.formula,
            additional_paths=attached_attribute_paths,
        )
        candidate = deepcopy(sheet)
        setattr(candidate.stats, request.stat_name, formula)
        validate_and_evaluate_sheet_attributes(candidate)

        path = state_sync_service.join_path(
            "sheets",
            request.sheet_id,
            "stats",
            request.stat_name,
        )
        op = state_sync_service.set_mutation(state, path, formula)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def set_resistances(request: SetSheetResistances) -> None:
    resistances = Resistances.from_dict(request.resistances.model_dump(mode="python"))

    def mutation(state: State) -> tuple[None, list]:
        if request.sheet_id not in state.sheets:
            raise ValueError(f"Sheet '{request.sheet_id}' does not exist.")

        path = state_sync_service.join_path(
            "sheets",
            request.sheet_id,
            "resistances",
        )
        op = state_sync_service.set_mutation(state, path, resistances)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)
