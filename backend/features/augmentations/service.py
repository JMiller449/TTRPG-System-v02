from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from copy import deepcopy
from dataclasses import dataclass
from typing import Any, Literal

from backend.core.transport import PatchOp
from backend.features.formula_runtime.service import (
    FormulaExecutionContext,
    EvaluationTimeEffect,
    apply_numeric_operation,
    evaluate_numeric_formula,
    normalize_numeric_result,
)
from backend.features.state_sync.service import state_sync_service
from backend.features.variable_registry.service import is_augmentation_target_allowed
from backend.state.models.augmentation import (
    Augmentation,
    AugmentationSource,
    EquipmentEffectProjection,
    StandaloneEffectApplication,
    StandaloneEffectDefinition,
)
from backend.state.models.condition import ActiveCondition
from backend.state.models.shared import Bridge
from backend.state.models.state import State


@dataclass
class AugmentationMutationResult:
    augmentation_id: str
    operation: Literal["applied", "removed", "ignored"]
    target_path: str | None = None
    value: int | float | None = None
    reason: str | None = None


@dataclass
class ConditionPresetHookResult:
    condition_id: str
    instance_id: str
    operation: Literal["applied", "removed", "ignored"]
    augmentation_results: list[AugmentationMutationResult]
    reason: str | None = None


@dataclass
class _ResolvedTarget:
    state_path: str
    root: Any
    target_id: str | None


class _AugmentationFormulaRoot:
    def __init__(self, state: State, target_root: Any, augmentation: Augmentation) -> None:
        self._target_root = target_root
        self.instance = target_root if hasattr(target_root, "parent_id") else None
        self.sheet = target_root
        if self.instance is not None:
            self.sheet = state.sheets.get(self.instance.parent_id)
        self.source_item = _source_item_formula_values(state, augmentation)

    def __getattr__(self, name: str) -> Any:
        return getattr(self._target_root, name)


def _source_item_formula_values(
    state: State,
    augmentation: Augmentation,
) -> dict[str, dict[str, float | int]] | None:
    if augmentation.source.type != "item" or augmentation.source.id is None:
        return None
    item = state.items.get(augmentation.source.id)
    if item is None:
        return None
    values: dict[str, float | int] = {}
    for fact_id, bridge in item.facts.items():
        definition = state.facts.get(fact_id)
        if (
            definition is None
            or definition.value_type != "number"
            or "item" not in definition.subject_types
            or (
                definition.required_profile is not None
                and definition.required_profile != item.fact_profile
            )
            or bridge.evaluation_error is not None
            or isinstance(bridge.evaluated_value, bool)
            or not isinstance(bridge.evaluated_value, int | float)
        ):
            continue
        values[fact_id] = bridge.evaluated_value
    return {"facts": values}


def _evaluate_formula(state: State, root: Any, augmentation: Augmentation) -> float | int:
    if augmentation.effect.type == "roll_mode_modifier":
        raise ValueError("Roll-mode modifier effects do not contain numeric formulas.")
    return evaluate_numeric_formula(
        _AugmentationFormulaRoot(state, root, augmentation),
        augmentation.effect.value,
    )


def _is_evaluation_time_effect(augmentation: Augmentation) -> bool:
    return augmentation.effect.type in {
        "evaluation_formula_modifier",
        "roll_mode_modifier",
    }


def _effect_matches_context(
    effect: EvaluationTimeEffect,
    context: FormulaExecutionContext,
    *,
    effect_source_item_relationship_id: str | None = None,
) -> bool:
    return effect.selector.matches(
        tags=list(context.tags),
        action_id=context.action_id,
        formula_id=context.formula_id,
        step_id=context.step_id,
        source_item_relationship_id=context.source_item_relationship_id,
        effect_source_item_relationship_id=effect_source_item_relationship_id,
    )


def matching_evaluation_effects(
    state: State,
    *,
    sheet_id: str,
    instance_id: str | None,
    context: FormulaExecutionContext,
) -> tuple[EvaluationTimeEffect, ...]:
    effects: list[EvaluationTimeEffect] = []

    if instance_id is not None:
        for application in state.standalone_effect_applications.values():
            if not application.active or application.instance_id != instance_id:
                continue
            definition = state.standalone_effects.get(application.definition_id)
            if (
                definition is None
                or not definition.active
                or definition.effect.type
                not in {"evaluation_formula_modifier", "roll_mode_modifier"}
            ):
                continue
            if _effect_matches_context(definition.effect, context):
                effects.append(definition.effect)

    for augmentation in state.augmentations.values():
        if (
            augmentation.lifecycle_owner != "condition"
            or not augmentation.active
            or not augmentation.applied
            or not _is_evaluation_time_effect(augmentation)
        ):
            continue
        expected_target_id = sheet_id if augmentation.scope == "sheet" else instance_id
        if expected_target_id is None:
            continue
        if augmentation.applied_target_id != expected_target_id:
            continue
        if _effect_matches_context(augmentation.effect, context):
            effects.append(augmentation.effect)

    sheet = state.sheets.get(sheet_id)
    if sheet is None:
        return tuple(effects)

    for bridge in sheet.items.values():
        if not bridge.equipped or bridge.count <= 0:
            continue
        item = state.items.get(bridge.item_id)
        if item is None or item.interaction_type != "equippable":
            continue
        for template in item.augmentation_templates:
            if not template.active or not _is_evaluation_time_effect(template):
                continue
            if template.scope == "instance" and instance_id is None:
                continue
            if _effect_matches_context(
                template.effect,
                context,
                effect_source_item_relationship_id=bridge.relationship_id,
            ):
                effects.append(template.effect)

    return tuple(effects)


def _equipment_augmentation_id(
    *,
    sheet_id: str,
    relationship_id: str,
    item_id: str,
    target_id: str,
    template_id: str,
) -> str:
    identity = json.dumps(
        [sheet_id, relationship_id, item_id, target_id, template_id],
        separators=(",", ":"),
    )
    digest = hashlib.sha256(identity.encode("utf-8")).hexdigest()[:24]
    return f"equipment:{digest}"


def _desired_equipment_augmentations(state: State) -> dict[str, Augmentation]:
    desired: dict[str, Augmentation] = {}
    instances_by_sheet: dict[str, list[str]] = defaultdict(list)
    for instance_id, instance in sorted(state.instanced_sheets.items()):
        instances_by_sheet[instance.parent_id].append(instance_id)

    for sheet_id, sheet in sorted(state.sheets.items()):
        for bridge_key, bridge in sorted(sheet.items.items()):
            if not bridge.equipped or bridge.count <= 0:
                continue
            item = state.items.get(bridge.item_id)
            if item is None or item.interaction_type != "equippable":
                continue

            application_id = f"equipment:{sheet_id}:{bridge.relationship_id}"
            for template in item.augmentation_templates:
                if not template.active:
                    continue
                _validate_runtime_augmentation_target(template)
                target_ids = (
                    [sheet_id]
                    if template.target.root == "sheet"
                    else instances_by_sheet.get(sheet_id, [])
                )
                for target_id in target_ids:
                    augmentation = deepcopy(template)
                    augmentation.id = _equipment_augmentation_id(
                        sheet_id=sheet_id,
                        relationship_id=bridge.relationship_id,
                        item_id=item.id,
                        target_id=target_id,
                        template_id=template.id,
                    )
                    augmentation.source = AugmentationSource(
                        type="item",
                        id=item.id,
                        label=item.name,
                        relationship_id=bridge.relationship_id,
                        application_id=application_id,
                    )
                    augmentation.lifecycle_owner = "equipment"
                    augmentation.active = True
                    augmentation.applied = True
                    augmentation.applied_target_id = target_id
                    desired[augmentation.id] = augmentation

    return desired


def standalone_effect_application_id(definition_id: str, instance_id: str) -> str:
    return f"standalone:{instance_id}:{definition_id}"


def _standalone_application_augmentation(
    definition: StandaloneEffectDefinition,
    application: StandaloneEffectApplication,
) -> Augmentation:
    return Augmentation(
        id=application.application_id,
        name=definition.name,
        description=definition.description,
        source=deepcopy(application.source),
        scope=definition.scope,
        target=deepcopy(definition.target),
        effect=deepcopy(definition.effect),
        active=definition.active and application.active,
        applied=True,
        applied_target_id=application.instance_id,
        lifecycle_owner="action",
        lifecycle=deepcopy(definition.lifecycle),
    )


def _desired_standalone_augmentations(state: State) -> dict[str, Augmentation]:
    desired: dict[str, Augmentation] = {}
    for application_id, application in sorted(
        state.standalone_effect_applications.items()
    ):
        if not application.active:
            continue
        definition = state.standalone_effects.get(application.definition_id)
        if definition is None or not definition.active:
            continue
        augmentation = _standalone_application_augmentation(definition, application)
        _validate_runtime_augmentation_target(augmentation)
        desired[application_id] = augmentation
    return desired


def _desired_projected_augmentations(
    state: State,
    *,
    equipment: dict[str, Augmentation] | None = None,
) -> dict[str, Augmentation]:
    return {
        **(_desired_equipment_augmentations(state) if equipment is None else equipment),
        **_desired_standalone_augmentations(state),
    }


def _equipment_projection_path(target_path: str) -> str:
    return state_sync_service.join_path("equipment_effect_projections", target_path)


def _set_numeric_value(state: State, state_path: str, value: int | float) -> None:
    state_sync_service.set_mutation(state, state_path, value)


def _adjusted_projection_base(
    projection: EquipmentEffectProjection,
    current_value: int | float,
) -> int | float:
    external_delta = current_value - projection.effective_value
    return normalize_numeric_result(projection.base_value + external_delta)


def _sync_equipment_direct_effects(
    state: State,
    desired: dict[str, Augmentation],
) -> list[PatchOp]:
    effects_by_path: dict[str, list[Augmentation]] = defaultdict(list)
    for augmentation in desired.values():
        if augmentation.effect.type != "formula_modifier":
            continue
        target = _resolve_target(
            state,
            augmentation,
            sheet_id=(
                augmentation.applied_target_id
                if augmentation.target.root == "sheet"
                else None
            ),
            instance_id=(
                augmentation.applied_target_id
                if augmentation.target.root == "instance"
                else None
            ),
        )
        effects_by_path[target.state_path].append(augmentation)

    base_values: dict[str, int | float] = {}
    existing_paths = set(state.equipment_effect_projections)
    desired_paths = set(effects_by_path)
    ops: list[PatchOp] = []

    for target_path in sorted(existing_paths | desired_paths):
        projection = state.equipment_effect_projections.get(target_path)
        try:
            current_value = _current_numeric_value(state, target_path)
        except ValueError:
            if projection is not None:
                _, remove_op = state_sync_service.remove_mutation(
                    state,
                    _equipment_projection_path(target_path),
                )
                ops.append(remove_op)
            continue

        base_values[target_path] = (
            current_value
            if projection is None
            else _adjusted_projection_base(projection, current_value)
        )

    working_state = deepcopy(state)
    for target_path, base_value in base_values.items():
        _set_numeric_value(working_state, target_path, base_value)

    effective_values: dict[str, int | float] = {}
    for target_path in sorted(desired_paths):
        for augmentation in sorted(effects_by_path[target_path], key=lambda entry: entry.id):
            target = _resolve_target(
                working_state,
                augmentation,
                sheet_id=(
                    augmentation.applied_target_id
                    if augmentation.target.root == "sheet"
                    else None
                ),
                instance_id=(
                    augmentation.applied_target_id
                    if augmentation.target.root == "instance"
                    else None
                ),
            )
            current_value = _current_numeric_value(working_state, target_path)
            modifier = _evaluate_formula(working_state, target.root, augmentation)
            next_value = apply_numeric_operation(
                current_value,
                modifier,
                augmentation.effect.operation,
            )
            _set_numeric_value(working_state, target_path, next_value)
        effective_values[target_path] = _current_numeric_value(
            working_state,
            target_path,
        )

    for target_path in sorted(existing_paths | desired_paths):
        if target_path not in base_values:
            continue
        base_value = base_values[target_path]
        effective_value = effective_values.get(target_path, base_value)
        current_value = _current_numeric_value(state, target_path)
        if current_value != effective_value:
            ops.append(
                state_sync_service.set_mutation(
                    state,
                    target_path,
                    effective_value,
                )
            )

        projection = state.equipment_effect_projections.get(target_path)
        if target_path not in desired_paths:
            if projection is not None:
                _, remove_op = state_sync_service.remove_mutation(
                    state,
                    _equipment_projection_path(target_path),
                )
                ops.append(remove_op)
            continue

        next_projection = EquipmentEffectProjection(
            target_path=target_path,
            base_value=base_value,
            effective_value=effective_value,
        )
        projection_path = _equipment_projection_path(target_path)
        if projection is None:
            ops.append(
                state_sync_service.add_mutation(
                    state,
                    projection_path,
                    next_projection,
                )
            )
        elif projection != next_projection:
            ops.append(
                state_sync_service.set_mutation(
                    state,
                    projection_path,
                    next_projection,
                )
            )

    return ops


def synchronize_equipment_augmentations_mutation(state: State) -> list[PatchOp]:
    desired = _desired_equipment_augmentations(state)
    existing_ids = {
        augmentation_id
        for augmentation_id, augmentation in state.augmentations.items()
        if augmentation.lifecycle_owner == "equipment"
    }
    desired_ids = set(desired)
    managed_ids = existing_ids | desired_ids
    ops: list[PatchOp] = []

    for instance_id, instance in sorted(state.instanced_sheets.items()):
        desired_instance_ids = {
            augmentation_id
            for augmentation_id, augmentation in desired.items()
            if augmentation.target.root == "instance"
            and augmentation.applied_target_id == instance_id
        }
        for bridge_key, bridge in list(instance.augments.items()):
            if bridge.entry_id in managed_ids and bridge.entry_id not in desired_instance_ids:
                _, remove_op = state_sync_service.remove_mutation(
                    state,
                    state_sync_service.join_path(
                        "instanced_sheets", instance_id, "augments", bridge_key
                    ),
                )
                ops.append(remove_op)

    for augmentation_id in sorted(existing_ids - desired_ids):
        _, remove_op = state_sync_service.remove_mutation(
            state,
            state_sync_service.join_path("augmentations", augmentation_id),
        )
        ops.append(remove_op)

    for augmentation_id, augmentation in sorted(desired.items()):
        current = state.augmentations.get(augmentation_id)
        augmentation_path = state_sync_service.join_path(
            "augmentations", augmentation_id
        )
        if current is None:
            ops.append(
                state_sync_service.add_mutation(state, augmentation_path, augmentation)
            )
        elif current != augmentation:
            ops.append(
                state_sync_service.set_mutation(state, augmentation_path, augmentation)
            )

        if augmentation.target.root != "instance":
            continue
        instance_id = augmentation.applied_target_id
        if instance_id is None:
            continue
        bridge = _condition_bridge(augmentation_id)
        bridge_path = state_sync_service.join_path(
            "instanced_sheets", instance_id, "augments", augmentation_id
        )
        current_bridge = state.instanced_sheets[instance_id].augments.get(augmentation_id)
        if current_bridge is None:
            ops.append(state_sync_service.add_mutation(state, bridge_path, bridge))
        elif current_bridge != bridge:
            ops.append(state_sync_service.set_mutation(state, bridge_path, bridge))

    ops.extend(
        _sync_equipment_direct_effects(
            state,
            _desired_projected_augmentations(state, equipment=desired),
        )
    )
    return ops


def synchronize_projected_direct_effects_mutation(state: State) -> list[PatchOp]:
    return _sync_equipment_direct_effects(
        state,
        _desired_projected_augmentations(state),
    )


def validate_standalone_runtime_definition(
    definition: StandaloneEffectDefinition,
) -> None:
    if definition.scope != "instance" or definition.target.root != "instance":
        raise ValueError(
            "Standalone action-controlled effects must target an instance."
        )
    augmentation = Augmentation(
        id=definition.id,
        name=definition.name,
        description=definition.description,
        source=AugmentationSource(type="action", id=definition.id),
        scope=definition.scope,
        target=deepcopy(definition.target),
        effect=deepcopy(definition.effect),
        lifecycle_owner="action",
        lifecycle=deepcopy(definition.lifecycle),
    )
    _validate_runtime_augmentation_target(augmentation)


def apply_standalone_effect_mutation(
    state: State,
    definition_id: str,
    *,
    instance_id: str,
    action_id: str | None = None,
    step_id: str | None = None,
) -> tuple[AugmentationMutationResult, list[PatchOp]]:
    definition = state.standalone_effects.get(definition_id)
    if definition is None:
        raise ValueError(f"Standalone effect '{definition_id}' does not exist.")
    validate_standalone_runtime_definition(definition)
    if instance_id not in state.instanced_sheets:
        raise ValueError(f"Instanced sheet '{instance_id}' does not exist.")
    if not definition.active:
        return (
            AugmentationMutationResult(
                augmentation_id=definition_id,
                operation="ignored",
                reason="inactive",
            ),
            [],
        )

    application_id = standalone_effect_application_id(definition_id, instance_id)
    if application_id in state.standalone_effect_applications:
        return (
            AugmentationMutationResult(
                augmentation_id=definition_id,
                operation="ignored",
                reason="already_applied",
            ),
            [],
        )

    application = StandaloneEffectApplication(
        application_id=application_id,
        definition_id=definition_id,
        instance_id=instance_id,
        source=AugmentationSource(
            type="action" if action_id else "manual",
            id=action_id or definition_id,
            label=definition.name,
            relationship_id=step_id,
            application_id=application_id,
        ),
    )
    ops = [
        state_sync_service.add_mutation(
            state,
            state_sync_service.join_path(
                "standalone_effect_applications", application_id
            ),
            application,
        )
    ]
    ops.extend(synchronize_projected_direct_effects_mutation(state))
    augmentation = _standalone_application_augmentation(definition, application)
    if _is_evaluation_time_effect(augmentation):
        return (
            AugmentationMutationResult(
                augmentation_id=definition_id,
                operation="applied",
                reason="evaluation_time_effect_activated",
            ),
            ops,
        )
    target = _resolve_target(state, augmentation, instance_id=instance_id)
    return (
        AugmentationMutationResult(
            augmentation_id=definition_id,
            operation="applied",
            target_path=target.state_path,
            value=_current_numeric_value(state, target.state_path),
        ),
        ops,
    )


def remove_standalone_effect_mutation(
    state: State,
    definition_id: str,
    *,
    instance_id: str,
) -> tuple[AugmentationMutationResult, list[PatchOp]]:
    definition = state.standalone_effects.get(definition_id)
    if definition is None:
        raise ValueError(f"Standalone effect '{definition_id}' does not exist.")
    application_id = standalone_effect_application_id(definition_id, instance_id)
    application = state.standalone_effect_applications.get(application_id)
    if application is None:
        return (
            AugmentationMutationResult(
                augmentation_id=definition_id,
                operation="ignored",
                reason="not_applied",
            ),
            [],
        )

    _, remove_op = state_sync_service.remove_mutation(
        state,
        state_sync_service.join_path(
            "standalone_effect_applications", application_id
        ),
    )
    ops = [remove_op]
    ops.extend(synchronize_projected_direct_effects_mutation(state))
    if definition.effect.type in {
        "evaluation_formula_modifier",
        "roll_mode_modifier",
    }:
        return (
            AugmentationMutationResult(
                augmentation_id=definition_id,
                operation="removed",
                reason="evaluation_time_effect_deactivated",
            ),
            ops,
        )
    augmentation = _standalone_application_augmentation(definition, application)
    target = _resolve_target(state, augmentation, instance_id=instance_id)
    return (
        AugmentationMutationResult(
            augmentation_id=definition_id,
            operation="removed",
            target_path=target.state_path,
            value=_current_numeric_value(state, target.state_path),
        ),
        ops,
    )


def _target_label(augmentation: Augmentation) -> str:
    path = ".".join(augmentation.target.path)
    if not path:
        return augmentation.target.root
    return f"{augmentation.target.root}.{path}"


def _validate_runtime_augmentation_target(augmentation: Augmentation) -> None:
    if not augmentation.target.path:
        raise ValueError("Augmentation target path must not be empty.")

    if augmentation.target.root == "state":
        raise ValueError("Global state augmentation targets are not supported yet.")

    if not is_augmentation_target_allowed(
        root=augmentation.target.root,
        path=augmentation.target.path,
        context="runtime",
    ):
        raise ValueError(
            f"Runtime augmentation target '{_target_label(augmentation)}' is not allowed."
        )


def _resolve_target(
    state: State,
    augmentation: Augmentation,
    *,
    sheet_id: str | None = None,
    instance_id: str | None = None,
) -> _ResolvedTarget:
    _validate_runtime_augmentation_target(augmentation)

    if augmentation.target.root == "sheet":
        if augmentation.scope != "sheet":
            raise ValueError("Sheet augmentation targets must use sheet scope.")
        if sheet_id is None:
            sheet_id = augmentation.applied_target_id
        if sheet_id is None:
            raise ValueError("A sheet_id is required for sheet augmentation targets.")
        sheet = state.sheets.get(sheet_id)
        if sheet is None:
            raise ValueError(f"Sheet '{sheet_id}' does not exist.")
        return _ResolvedTarget(
            state_path=state_sync_service.join_path(
                "sheets", sheet_id, *augmentation.target.path
            ),
            root=sheet,
            target_id=sheet_id,
        )

    if augmentation.scope != "instance":
        raise ValueError("Instance augmentation targets must use instance scope.")
    if instance_id is None:
        instance_id = augmentation.applied_target_id
    if instance_id is None:
        raise ValueError("An instance_id is required for instance augmentation targets.")
    instance = state.instanced_sheets.get(instance_id)
    if instance is None:
        raise ValueError(f"Instanced sheet '{instance_id}' does not exist.")
    return _ResolvedTarget(
        state_path=state_sync_service.join_path(
            "instanced_sheets", instance_id, *augmentation.target.path
        ),
        root=instance,
        target_id=instance_id,
    )


def _current_numeric_value(state: State, state_path: str) -> int | float:
    container, leaf = state_sync_service._resolve_container(state, state_path)
    if isinstance(container, dict):
        if leaf not in container:
            raise ValueError(f"Augmentation target path {state_path} does not exist.")
        value = container[leaf]
    elif isinstance(container, list):
        index = state_sync_service._list_index(leaf)
        try:
            value = container[index]
        except IndexError as exc:
            raise ValueError(
                f"Augmentation target path {state_path} does not exist."
            ) from exc
    else:
        if not hasattr(container, leaf):
            raise ValueError(f"Augmentation target path {state_path} does not exist.")
        value = getattr(container, leaf)

    if not isinstance(value, int | float):
        raise ValueError(f"Augmentation target path {state_path} is not numeric.")
    return value


def _remove_operation(
    current_value: int | float,
    modifier: int | float,
    operation: str,
) -> int | float:
    if operation == "add":
        return normalize_numeric_result(current_value - modifier)
    if operation == "subtract":
        return normalize_numeric_result(current_value + modifier)
    if operation == "multiply":
        if modifier == 0:
            raise ValueError("Cannot remove a multiply-by-zero augmentation.")
        return normalize_numeric_result(current_value / modifier)
    if operation == "divide":
        return normalize_numeric_result(current_value * modifier)
    if operation == "set":
        raise ValueError("Set augmentations cannot be removed without stored base state.")
    raise ValueError(f"Unsupported augmentation operation '{operation}'.")


def _set_application_state_ops(
    state: State,
    augmentation_id: str,
    *,
    applied: bool,
    applied_target_id: str | None,
) -> list[PatchOp]:
    return [
        state_sync_service.set_mutation(
            state,
            state_sync_service.join_path("augmentations", augmentation_id, "applied"),
            applied,
        ),
        state_sync_service.set_mutation(
            state,
            state_sync_service.join_path(
                "augmentations", augmentation_id, "applied_target_id"
            ),
            applied_target_id,
        ),
    ]


def _apply_condition_effect_mutation(
    state: State,
    augmentation_id: str,
    *,
    instance_id: str,
) -> tuple[AugmentationMutationResult, list[PatchOp]]:
    augmentation = state.augmentations.get(augmentation_id)
    if augmentation is None:
        raise ValueError(f"Augmentation '{augmentation_id}' does not exist.")
    if augmentation.lifecycle_owner != "condition":
        raise ValueError(
            f"Augmentation '{augmentation_id}' is not a condition-owned effect."
        )

    if not augmentation.active:
        return (
            AugmentationMutationResult(
                augmentation_id=augmentation_id,
                operation="ignored",
                reason="inactive",
            ),
            [],
        )

    if augmentation.applied:
        return (
            AugmentationMutationResult(
                augmentation_id=augmentation_id,
                operation="ignored",
                reason="already_applied",
            ),
            [],
        )

    target = _resolve_target(
        state,
        augmentation,
        instance_id=instance_id,
    )
    if _is_evaluation_time_effect(augmentation):
        ops = _set_application_state_ops(
            state,
            augmentation_id,
            applied=True,
            applied_target_id=target.target_id,
        )
        return (
            AugmentationMutationResult(
                augmentation_id=augmentation_id,
                operation="applied",
                reason="evaluation_time_effect_activated",
            ),
            ops,
        )

    current_value = _current_numeric_value(state, target.state_path)
    modifier = _evaluate_formula(state, target.root, augmentation)
    next_value = apply_numeric_operation(
        current_value,
        modifier,
        augmentation.effect.operation,
    )

    ops = [
        state_sync_service.set_mutation(state, target.state_path, next_value),
        *_set_application_state_ops(
            state,
            augmentation_id,
            applied=True,
            applied_target_id=target.target_id,
        ),
    ]
    return (
        AugmentationMutationResult(
            augmentation_id=augmentation_id,
            operation="applied",
            target_path=target.state_path,
            value=next_value,
        ),
        ops,
    )


def _remove_condition_effect_mutation(
    state: State,
    augmentation_id: str,
    *,
    instance_id: str,
) -> tuple[AugmentationMutationResult, list[PatchOp]]:
    augmentation = state.augmentations.get(augmentation_id)
    if augmentation is None:
        raise ValueError(f"Augmentation '{augmentation_id}' does not exist.")
    if augmentation.lifecycle_owner != "condition":
        raise ValueError(
            f"Augmentation '{augmentation_id}' is not a condition-owned effect."
        )

    if not augmentation.applied:
        return (
            AugmentationMutationResult(
                augmentation_id=augmentation_id,
                operation="ignored",
                reason="not_applied",
            ),
            [],
        )

    target = _resolve_target(
        state,
        augmentation,
        instance_id=instance_id,
    )
    if augmentation.applied_target_id != target.target_id:
        raise ValueError(
            f"Augmentation '{augmentation_id}' is applied to "
            f"'{augmentation.applied_target_id}', not '{target.target_id}'."
        )

    if _is_evaluation_time_effect(augmentation):
        ops = _set_application_state_ops(
            state,
            augmentation_id,
            applied=False,
            applied_target_id=None,
        )
        return (
            AugmentationMutationResult(
                augmentation_id=augmentation_id,
                operation="removed",
                reason="evaluation_time_effect_deactivated",
            ),
            ops,
        )

    current_value = _current_numeric_value(state, target.state_path)
    modifier = _evaluate_formula(state, target.root, augmentation)
    next_value = _remove_operation(
        current_value,
        modifier,
        augmentation.effect.operation,
    )

    ops = [
        state_sync_service.set_mutation(state, target.state_path, next_value),
        *_set_application_state_ops(
            state,
            augmentation_id,
            applied=False,
            applied_target_id=None,
        ),
    ]
    return (
        AugmentationMutationResult(
            augmentation_id=augmentation_id,
            operation="removed",
            target_path=target.state_path,
            value=next_value,
        ),
        ops,
    )


def _condition_augmentation_id(
    condition_id: str,
    instance_id: str,
    template_id: str,
) -> str:
    return f"condition:{condition_id}:{instance_id}:{template_id}"


def _condition_application_id(condition_id: str, instance_id: str) -> str:
    return f"condition:{condition_id}:{instance_id}"


def _build_condition_augmentation(
    template: Augmentation,
    *,
    condition_id: str,
    condition_name: str,
    instance_id: str,
) -> Augmentation:
    if template.scope != "instance" or template.target.root != "instance":
        raise ValueError(
            "Condition preset augmentation templates must target the current instance."
        )

    augmentation = deepcopy(template)
    augmentation.id = _condition_augmentation_id(
        condition_id,
        instance_id,
        template.id,
    )
    augmentation.source = AugmentationSource(
        type="condition",
        id=condition_id,
        label=condition_name,
        application_id=_condition_application_id(condition_id, instance_id),
    )
    augmentation.lifecycle_owner = "condition"
    augmentation.applied = False
    augmentation.applied_target_id = None
    return augmentation


def _condition_bridge(augmentation_id: str) -> Bridge:
    return Bridge(
        relationship_id=augmentation_id,
        entry_id=augmentation_id,
    )


def _apply_condition_preset_mutation(
    state: State,
    *,
    instance_id: str,
    condition_id: str,
) -> tuple[ConditionPresetHookResult, list[PatchOp]]:
    instance = state.instanced_sheets.get(instance_id)
    if instance is None:
        raise ValueError(f"Instanced sheet '{instance_id}' does not exist.")

    condition = state.condition_presets.get(condition_id)
    if condition is None:
        raise ValueError(f"Condition preset '{condition_id}' does not exist.")

    application_id = _condition_application_id(condition_id, instance_id)
    if application_id in state.active_conditions:
        return (
            ConditionPresetHookResult(
                condition_id=condition_id,
                instance_id=instance_id,
                operation="ignored",
                augmentation_results=[],
                reason="already_applied",
            ),
            [],
        )

    results: list[AugmentationMutationResult] = []
    augmentation_ids = [
        _condition_augmentation_id(condition.id, instance_id, template.id)
        for template in condition.augmentation_templates
    ]
    active_condition = ActiveCondition(
        application_id=application_id,
        condition_id=condition.id,
        condition_name=condition.name,
        description=condition.description,
        visibility=condition.visibility,
        instance_id=instance_id,
        augmentation_ids=augmentation_ids,
    )
    ops: list[PatchOp] = [
        state_sync_service.add_mutation(
            state,
            state_sync_service.join_path("active_conditions", application_id),
            active_condition,
        )
    ]

    for template in condition.augmentation_templates:
        augmentation = _build_condition_augmentation(
            template,
            condition_id=condition.id,
            condition_name=condition.name,
            instance_id=instance_id,
        )

        if augmentation.id in state.augmentations:
            results.append(
                AugmentationMutationResult(
                    augmentation_id=augmentation.id,
                    operation="ignored",
                    reason="already_applied",
                )
            )
            continue

        add_augmentation_op = state_sync_service.add_mutation(
            state,
            state_sync_service.join_path("augmentations", augmentation.id),
            augmentation,
        )
        add_bridge_op = state_sync_service.add_mutation(
            state,
            state_sync_service.join_path(
                "instanced_sheets",
                instance_id,
                "augments",
                augmentation.id,
            ),
            _condition_bridge(augmentation.id),
        )
        result, apply_ops = _apply_condition_effect_mutation(
            state,
            augmentation.id,
            instance_id=instance_id,
        )

        results.append(result)
        ops.extend([add_augmentation_op, add_bridge_op, *apply_ops])

    return (
        ConditionPresetHookResult(
            condition_id=condition_id,
            instance_id=instance_id,
            operation="applied",
            augmentation_results=results,
        ),
        ops,
    )


def apply_condition_preset_mutation(
    state: State,
    *,
    instance_id: str,
    condition_id: str,
) -> tuple[ConditionPresetHookResult, list[PatchOp]]:
    return _apply_condition_preset_mutation(
        state,
        instance_id=instance_id,
        condition_id=condition_id,
    )


def _remove_condition_preset_mutation(
    state: State,
    *,
    instance_id: str,
    condition_id: str,
) -> tuple[ConditionPresetHookResult, list[PatchOp]]:
    if instance_id not in state.instanced_sheets:
        raise ValueError(f"Instanced sheet '{instance_id}' does not exist.")

    if condition_id not in state.condition_presets:
        raise ValueError(f"Condition preset '{condition_id}' does not exist.")

    application_id = _condition_application_id(condition_id, instance_id)
    if application_id not in state.active_conditions:
        return (
            ConditionPresetHookResult(
                condition_id=condition_id,
                instance_id=instance_id,
                operation="ignored",
                augmentation_results=[],
                reason="not_applied",
            ),
            [],
        )

    return _remove_condition_application_mutation(
        state,
        instance_id=instance_id,
        application_id=application_id,
    )


def _remove_condition_application_mutation(
    state: State,
    *,
    instance_id: str,
    application_id: str,
) -> tuple[ConditionPresetHookResult, list[PatchOp]]:
    if instance_id not in state.instanced_sheets:
        raise ValueError(f"Instanced sheet '{instance_id}' does not exist.")

    active_condition = state.active_conditions.get(application_id)
    if active_condition is None:
        raise ValueError(
            f"Active condition application '{application_id}' does not exist."
        )
    if active_condition.instance_id != instance_id:
        raise ValueError(
            f"Active condition application '{application_id}' is not applied to "
            f"instance '{instance_id}'."
        )

    results: list[AugmentationMutationResult] = []
    ops: list[PatchOp] = []

    for augmentation_id in active_condition.augmentation_ids:
        if augmentation_id not in state.augmentations:
            continue
        result, remove_ops = _remove_condition_effect_mutation(
            state,
            augmentation_id,
            instance_id=instance_id,
        )
        results.append(result)
        ops.extend(remove_ops)

        bridge_path = state_sync_service.join_path(
            "instanced_sheets",
            instance_id,
            "augments",
            augmentation_id,
        )
        if augmentation_id in state.instanced_sheets[instance_id].augments:
            _, remove_bridge_op = state_sync_service.remove_mutation(state, bridge_path)
            ops.append(remove_bridge_op)

        _, remove_augmentation_op = state_sync_service.remove_mutation(
            state,
            state_sync_service.join_path("augmentations", augmentation_id),
        )
        ops.append(remove_augmentation_op)

    _, remove_active_condition_op = state_sync_service.remove_mutation(
        state,
        state_sync_service.join_path("active_conditions", application_id),
    )
    ops.append(remove_active_condition_op)

    return (
        ConditionPresetHookResult(
            condition_id=active_condition.condition_id,
            instance_id=instance_id,
            operation="removed",
            augmentation_results=results,
        ),
        ops,
    )


def remove_condition_preset_mutation(
    state: State,
    *,
    instance_id: str,
    condition_id: str,
) -> tuple[ConditionPresetHookResult, list[PatchOp]]:
    return _remove_condition_preset_mutation(
        state,
        instance_id=instance_id,
        condition_id=condition_id,
    )


def remove_condition_application_mutation(
    state: State,
    *,
    instance_id: str,
    application_id: str,
) -> tuple[ConditionPresetHookResult, list[PatchOp]]:
    return _remove_condition_application_mutation(
        state,
        instance_id=instance_id,
        application_id=application_id,
    )


async def apply_condition_preset(
    *,
    instance_id: str,
    condition_id: str,
    request_id: str | None = None,
) -> ConditionPresetHookResult:
    def mutation(state: State) -> tuple[ConditionPresetHookResult, list[PatchOp]]:
        return _apply_condition_preset_mutation(
            state,
            instance_id=instance_id,
            condition_id=condition_id,
        )

    return await state_sync_service.apply_mutation(mutation, request_id=request_id)


async def remove_condition_preset(
    *,
    instance_id: str,
    condition_id: str,
    request_id: str | None = None,
) -> ConditionPresetHookResult:
    def mutation(state: State) -> tuple[ConditionPresetHookResult, list[PatchOp]]:
        return _remove_condition_preset_mutation(
            state,
            instance_id=instance_id,
            condition_id=condition_id,
        )

    return await state_sync_service.apply_mutation(mutation, request_id=request_id)


async def remove_condition_application(
    *,
    instance_id: str,
    application_id: str,
    request_id: str | None = None,
) -> ConditionPresetHookResult:
    def mutation(state: State) -> tuple[ConditionPresetHookResult, list[PatchOp]]:
        return _remove_condition_application_mutation(
            state,
            instance_id=instance_id,
            application_id=application_id,
        )

    return await state_sync_service.apply_mutation(mutation, request_id=request_id)
