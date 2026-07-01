from __future__ import annotations

from backend.features.augmentations import service as augmentation_service
from backend.features.standalone_effects.schema import (
    CreateStandaloneEffect,
    DeleteStandaloneEffect,
    UpdateStandaloneEffect,
)
from backend.features.state_sync.service import state_sync_service
from backend.protocol.state_schema import StandaloneEffectDefinitionPayload
from backend.state.models.action import ApplyAugmentationStep
from backend.state.models.augmentation import StandaloneEffectDefinition
from backend.state.models.state import State


def _build_definition(
    payload: StandaloneEffectDefinitionPayload,
) -> StandaloneEffectDefinition:
    definition = StandaloneEffectDefinition.from_dict(payload.model_dump(mode="json"))
    augmentation_service.validate_standalone_runtime_definition(definition)
    return definition


async def create_standalone_effect(request: CreateStandaloneEffect) -> None:
    definition = _build_definition(request.effect)

    def mutation(state: State) -> tuple[None, list]:
        if definition.id in state.standalone_effects:
            raise ValueError(f"Standalone effect '{definition.id}' already exists.")
        op = state_sync_service.add_mutation(
            state,
            state_sync_service.join_path("standalone_effects", definition.id),
            definition,
        )
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def update_standalone_effect(request: UpdateStandaloneEffect) -> None:
    if request.effect.id != request.effect_id:
        raise ValueError("Standalone effect ID cannot be changed.")
    definition = _build_definition(request.effect)

    def mutation(state: State) -> tuple[None, list]:
        if request.effect_id not in state.standalone_effects:
            raise ValueError(
                f"Standalone effect '{request.effect_id}' does not exist."
            )
        op = state_sync_service.set_mutation(
            state,
            state_sync_service.join_path(
                "standalone_effects", request.effect_id
            ),
            definition,
        )
        projection_ops = (
            augmentation_service.synchronize_projected_direct_effects_mutation(
                state
            )
        )
        return None, [op, *projection_ops]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def delete_standalone_effect(request: DeleteStandaloneEffect) -> None:
    def mutation(state: State) -> tuple[None, list]:
        if request.effect_id not in state.standalone_effects:
            raise ValueError(
                f"Standalone effect '{request.effect_id}' does not exist."
            )
        referencing_actions = sorted(
            action_id
            for action_id, action in state.actions.items()
            if any(
                isinstance(step, ApplyAugmentationStep)
                and step.augmentation_id == request.effect_id
                for step in action.steps
            )
        )
        if referencing_actions:
            raise ValueError(
                f"Standalone effect '{request.effect_id}' is referenced by actions: "
                + ", ".join(referencing_actions)
                + "."
            )
        active_applications = sorted(
            application_id
            for application_id, application in (
                state.standalone_effect_applications.items()
            )
            if application.definition_id == request.effect_id
        )
        if active_applications:
            raise ValueError(
                f"Standalone effect '{request.effect_id}' has active applications. "
                "Remove them before deleting the definition."
            )
        _, op = state_sync_service.remove_mutation(
            state,
            state_sync_service.join_path(
                "standalone_effects", request.effect_id
            ),
        )
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)
