from __future__ import annotations

from copy import deepcopy
from dataclasses import asdict, is_dataclass

from backend.features.sheet_admin.conditions.schema import (
    ConditionPresetPayload,
    CreateConditionPreset,
    DeleteConditionPreset,
    RemoveActiveCondition,
    UpdateConditionPreset,
)
from backend.features.state_sync.service import state_sync_service
from backend.features.variable_registry.service import is_augmentation_target_allowed
from backend.state.models.augmentation import Augmentation, AugmentationSource
from backend.state.models.action import ApplyConditionPresetStep
from backend.state.models.condition import ConditionPreset
from backend.state.models.state import State


def _target_label(augmentation: Augmentation) -> str:
    path = ".".join(augmentation.target.path)
    return f"{augmentation.target.root}.{path}" if path else augmentation.target.root


def _validate_condition_augmentation_template(augmentation: Augmentation) -> None:
    if augmentation.target.root != "instance" or augmentation.scope != "instance":
        raise ValueError(
            "Condition preset augmentation templates must target the current instance."
        )

    if not is_augmentation_target_allowed(
        root=augmentation.target.root,
        path=augmentation.target.path,
        context="condition_template",
    ):
        raise ValueError(
            "Condition preset augmentation template target "
            f"'{_target_label(augmentation)}' is not allowed."
        )


def _validate_condition_augmentation_templates(
    payload: ConditionPresetPayload,
) -> None:
    for template in payload.augmentation_templates:
        augmentation = Augmentation.from_dict(template.model_dump(mode="json"))
        _validate_condition_augmentation_template(augmentation)


def _build_condition_preset(payload: ConditionPresetPayload) -> ConditionPreset:
    _validate_condition_augmentation_templates(payload)
    condition = ConditionPreset.from_dict(payload.model_dump(mode="json"))
    for augmentation in condition.augmentation_templates:
        augmentation.source = AugmentationSource(
            type="condition",
            id=condition.id,
            label=condition.name,
        )
        augmentation.lifecycle_owner = "condition"
        augmentation.applied = False
        augmentation.applied_target_id = None
    return condition


def _merge_condition(current: dict, partial: dict) -> dict:
    merged = deepcopy(current)
    for key, value in partial.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _merge_condition(merged[key], value)
            continue
        merged[key] = value
    return merged


async def create_condition_preset(request: CreateConditionPreset) -> None:
    condition = _build_condition_preset(request.condition)

    def mutation(state: State) -> tuple[None, list]:
        if condition.id in state.condition_presets:
            raise ValueError(f"Condition preset '{condition.id}' already exists.")

        path = state_sync_service.join_path("condition_presets", condition.id)
        op = state_sync_service.add_mutation(state, path, condition)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def update_condition_preset(request: UpdateConditionPreset) -> None:
    def mutation(state: State) -> tuple[None, list]:
        current = state.condition_presets.get(request.condition_id)
        if current is None:
            raise ValueError(
                f"Condition preset '{request.condition_id}' does not exist."
            )

        merged = _merge_condition(
            asdict(current) if is_dataclass(current) else current,
            request.condition_partial,
        )
        payload = ConditionPresetPayload.model_validate(merged)
        if payload.id != request.condition_id:
            raise ValueError("Condition preset ID cannot be changed.")

        condition = _build_condition_preset(payload)
        path = state_sync_service.join_path("condition_presets", request.condition_id)
        op = state_sync_service.set_mutation(state, path, condition)
        ops = [op]
        for application_id, active_condition in list(state.active_conditions.items()):
            if active_condition.condition_id != request.condition_id:
                continue
            active_condition.condition_name = condition.name
            active_condition.description = condition.description
            active_condition.visibility = condition.visibility
            ops.append(
                state_sync_service.set_mutation(
                    state,
                    state_sync_service.join_path(
                        "active_conditions", application_id
                    ),
                    active_condition,
                )
            )
            for augmentation_id in active_condition.augmentation_ids:
                augmentation = state.augmentations.get(augmentation_id)
                if augmentation is None:
                    continue
                augmentation.source.label = condition.name
                ops.append(
                    state_sync_service.set_mutation(
                        state,
                        state_sync_service.join_path(
                            "augmentations", augmentation_id
                        ),
                        augmentation,
                    )
                )
                bridge = state.instanced_sheets[
                    active_condition.instance_id
                ].augments.get(augmentation_id)
                if bridge is not None:
                    ops.append(
                        state_sync_service.set_mutation(
                            state,
                            state_sync_service.join_path(
                                "instanced_sheets",
                                active_condition.instance_id,
                                "augments",
                                augmentation_id,
                            ),
                            bridge,
                        )
                    )
        return None, ops

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def delete_condition_preset(request: DeleteConditionPreset) -> None:
    def mutation(state: State) -> tuple[None, list]:
        if request.condition_id not in state.condition_presets:
            raise ValueError(
                f"Condition preset '{request.condition_id}' does not exist."
            )
        referencing_actions = sorted(
            action_id
            for action_id, action in state.actions.items()
            if any(
                isinstance(step, ApplyConditionPresetStep)
                and step.condition_id == request.condition_id
                for step in action.steps
            )
        )
        if referencing_actions:
            action_ids = ", ".join(referencing_actions)
            raise ValueError(
                f"Condition preset '{request.condition_id}' is referenced by "
                f"actions: {action_ids}."
            )
        active_applications = sorted(
            application_id
            for application_id, active_condition in state.active_conditions.items()
            if active_condition.condition_id == request.condition_id
        )
        if active_applications:
            raise ValueError(
                f"Condition preset '{request.condition_id}' has active applications. "
                "Remove them before deleting the preset."
            )

        path = state_sync_service.join_path("condition_presets", request.condition_id)
        _, op = state_sync_service.remove_mutation(state, path)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def remove_active_condition(request: RemoveActiveCondition) -> None:
    from backend.features.augmentations.service import remove_condition_application

    await remove_condition_application(
        instance_id=request.instance_id,
        application_id=request.application_id,
        request_id=request.request_id,
    )
