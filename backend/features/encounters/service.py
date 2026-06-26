from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone

from backend.features.encounters.schema import (
    DeleteEncounterPreset,
    EncounterPresetPayload,
    SaveEncounterPreset,
    SpawnEncounterPreset,
)
from backend.features.formula_runtime.service import evaluate_numeric_formula
from backend.features.state_sync.service import state_sync_service
from backend.state.models.encounter import EncounterEntry, EncounterPreset
from backend.state.models.sheet import InstancedSheet
from backend.state.models.state import State


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _build_encounter(payload: EncounterPresetPayload) -> EncounterPreset:
    return EncounterPreset(
        id=payload.id,
        name=payload.name,
        entries=[
            EncounterEntry(
                template_id=entry.template_id,
                count=entry.count,
            )
            for entry in payload.entries
        ],
        updated_at=payload.updated_at or _now_iso(),
    )


def _validate_encounter_references(encounter: EncounterPreset, state: State) -> None:
    for entry in encounter.entries:
        if entry.template_id not in state.sheets:
            raise ValueError(f"Sheet '{entry.template_id}' does not exist.")


def _next_instance_id(
    *,
    state: State,
    encounter_id: str,
    template_id: str,
    index: int,
) -> str:
    base_id = f"{encounter_id}_{template_id}_{index}"
    if base_id not in state.instanced_sheets:
        return base_id

    suffix = 2
    while f"{base_id}_{suffix}" in state.instanced_sheets:
        suffix += 1
    return f"{base_id}_{suffix}"


def _initial_instance_for_template(
    state: State,
    *,
    template_id: str,
) -> InstancedSheet:
    template = state.sheets[template_id]
    health = evaluate_numeric_formula(template, template.stats.health)
    mana = evaluate_numeric_formula(template, template.stats.mana)
    if not float(mana).is_integer():
        raise ValueError(f"Sheet '{template_id}' mana formula must resolve to a whole number.")

    return InstancedSheet(
        parent_id=template_id,
        notes="",
        health=health,
        mana=int(mana),
        resistances=deepcopy(template.resistances),
        augments={},
    )


async def save_encounter_preset(request: SaveEncounterPreset) -> None:
    encounter = _build_encounter(request.encounter)

    def mutation(state: State) -> tuple[None, list]:
        _validate_encounter_references(encounter, state)
        path = state_sync_service.join_path("encounter_presets", encounter.id)
        if encounter.id in state.encounter_presets:
            op = state_sync_service.set_mutation(state, path, encounter)
        else:
            op = state_sync_service.add_mutation(state, path, encounter)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def delete_encounter_preset(request: DeleteEncounterPreset) -> None:
    def mutation(state: State) -> tuple[None, list]:
        if request.encounter_id not in state.encounter_presets:
            raise ValueError(f"Encounter preset '{request.encounter_id}' does not exist.")

        path = state_sync_service.join_path("encounter_presets", request.encounter_id)
        _, op = state_sync_service.remove_mutation(state, path)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def spawn_encounter_preset(request: SpawnEncounterPreset) -> None:
    def mutation(state: State) -> tuple[None, list]:
        encounter = state.encounter_presets.get(request.encounter_id)
        if encounter is None:
            raise ValueError(f"Encounter preset '{request.encounter_id}' does not exist.")
        _validate_encounter_references(encounter, state)

        ops = []
        for entry in encounter.entries:
            for index in range(1, entry.count + 1):
                instance_id = _next_instance_id(
                    state=state,
                    encounter_id=encounter.id,
                    template_id=entry.template_id,
                    index=index,
                )
                instance = _initial_instance_for_template(
                    state,
                    template_id=entry.template_id,
                )
                path = state_sync_service.join_path("instanced_sheets", instance_id)
                ops.append(state_sync_service.add_mutation(state, path, instance))
        return None, ops

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)
