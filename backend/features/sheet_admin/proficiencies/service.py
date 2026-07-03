from __future__ import annotations

from backend.features.sheet_admin.proficiencies.schema import (
    CreateProficiency,
    DeleteProficiency,
    ProficiencyDefinitionPayload,
    UpdateProficiency,
)
from backend.features.state_sync.service import state_sync_service
from backend.state.models.proficiency import Proficiency
from backend.state.models.state import State


def _build_proficiency(payload: ProficiencyDefinitionPayload) -> Proficiency:
    return Proficiency(
        id=payload.id,
        name=payload.name,
        description=payload.description,
    )


async def create_proficiency(request: CreateProficiency) -> None:
    proficiency = _build_proficiency(request.proficiency)

    def mutation(state: State) -> tuple[None, list]:
        if request.proficiency.id in state.proficiencies:
            raise ValueError(
                f"Proficiency '{request.proficiency.id}' already exists."
            )

        path = state_sync_service.join_path("proficiencies", request.proficiency.id)
        op = state_sync_service.add_mutation(state, path, proficiency)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def update_proficiency(request: UpdateProficiency) -> None:
    if request.proficiency.id != request.proficiency_id:
        raise ValueError("Proficiency ID cannot be changed.")

    proficiency = _build_proficiency(request.proficiency)

    def mutation(state: State) -> tuple[None, list]:
        if request.proficiency_id not in state.proficiencies:
            raise ValueError(f"Proficiency '{request.proficiency_id}' does not exist.")

        path = state_sync_service.join_path("proficiencies", request.proficiency_id)
        op = state_sync_service.set_mutation(state, path, proficiency)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def delete_proficiency(request: DeleteProficiency) -> None:
    def mutation(state: State) -> tuple[None, list]:
        if request.proficiency_id not in state.proficiencies:
            raise ValueError(f"Proficiency '{request.proficiency_id}' does not exist.")

        fact_references = sorted(
            f"{subject_type} '{subject.id}'"
            for subject_type, subjects in (
                ("sheet", state.sheets.values()),
                ("item", state.items.values()),
                ("action", state.actions.values()),
            )
            for subject in subjects
            for fact_id, bridge in subject.facts.items()
            if state.facts.get(fact_id) is not None
            and state.facts[fact_id].reference_kind == "proficiency"
            and bridge.evaluated_value == request.proficiency_id
        )
        if fact_references:
            raise ValueError(
                f"Proficiency '{request.proficiency_id}' is referenced by Facts on: "
                + ", ".join(fact_references)
                + "."
            )

        path = state_sync_service.join_path("proficiencies", request.proficiency_id)
        _, op = state_sync_service.remove_mutation(state, path)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)
