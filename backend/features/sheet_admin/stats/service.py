from __future__ import annotations

from backend.features.sheet_admin.formulas.service import build_formula
from backend.features.sheet_admin.stats.schema import (
    SetSheetBaseStat,
    SetSheetFormulaStat,
)
from backend.features.state_sync.service import state_sync_service
from backend.state.models.state import State


async def set_base_stat(request: SetSheetBaseStat) -> None:
    def mutation(state: State) -> tuple[None, list]:
        if request.sheet_id not in state.sheets:
            raise ValueError(f"Sheet '{request.sheet_id}' does not exist.")

        path = state_sync_service.join_path(
            "sheets",
            request.sheet_id,
            "stats",
            request.stat_name,
        )
        op = state_sync_service.set_mutation(state, path, request.value)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def set_formula_stat(request: SetSheetFormulaStat) -> None:
    formula = build_formula(request.formula)

    def mutation(state: State) -> tuple[None, list]:
        if request.sheet_id not in state.sheets:
            raise ValueError(f"Sheet '{request.sheet_id}' does not exist.")

        path = state_sync_service.join_path(
            "sheets",
            request.sheet_id,
            "stats",
            request.stat_name,
        )
        op = state_sync_service.set_mutation(state, path, formula)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)
