from __future__ import annotations

import hashlib

from backend.features.augmentations import service as augmentation_service
from backend.features.standalone_effects.schema import (
    CreateStandaloneEffect,
    DeleteStandaloneEffect,
    UpdateStandaloneEffect,
)
from backend.features.state_sync.service import state_sync_service
from backend.protocol.state_schema import StandaloneEffectDefinitionPayload
from backend.state.models.action import ApplyAugmentationStep
from backend.state.models.augmentation import (
    EvaluationFormulaModifierEffect,
    FormulaModifierEffect,
    StandaloneEffectDefinition,
)
from backend.state.models.formula import (
    Formula,
    FormulaDefinition,
    FormulaReference,
    resolve_formula_source,
)
from backend.state.models.state import State
from backend.state.models.tag import validate_tag_ids


def _build_definition(
    payload: StandaloneEffectDefinitionPayload,
    state: State | None = None,
) -> StandaloneEffectDefinition:
    definition = StandaloneEffectDefinition.from_dict(payload.model_dump(mode="json"))
    if isinstance(
        definition.effect,
        FormulaModifierEffect | EvaluationFormulaModifierEffect,
    ) and isinstance(definition.effect.value, FormulaReference):
        if state is None:
            raise ValueError("Effect formula validation requires authoritative state.")
        resolve_formula_source(definition.effect.value, state.formulas)
    augmentation_service.validate_standalone_runtime_definition(definition)
    return definition


def _centralize_effect_formula(
    definition: StandaloneEffectDefinition,
    state: State,
) -> tuple[StandaloneEffectDefinition, list]:
    """Promote legacy inline modifier formulas into the shared registry."""
    if not isinstance(
        definition.effect,
        FormulaModifierEffect | EvaluationFormulaModifierEffect,
    ) or not isinstance(definition.effect.value, Formula):
        return definition, []

    digest = hashlib.sha1(
        f"effect\0{definition.id}\0value".encode("utf-8")
    ).hexdigest()[:16]
    formula_id = f"formula_effect_{digest}"
    formula_definition = FormulaDefinition(
        id=formula_id,
        formula=definition.effect.value,
    )
    validate_tag_ids(formula_definition.formula.tags, state.tags)
    path = state_sync_service.join_path("formulas", formula_id)
    if formula_id in state.formulas:
        formula_op = state_sync_service.set_mutation(
            state,
            path,
            formula_definition,
        )
    else:
        formula_op = state_sync_service.add_mutation(
            state,
            path,
            formula_definition,
        )
    definition.effect.value = FormulaReference(formula_id=formula_id)
    return definition, [formula_op]


def validate_effect_definition_references(
    definition: StandaloneEffectDefinition,
    state: State,
) -> None:
    """Validate a canonical definition in every source context that references it."""
    from backend.features.sheet_admin.conditions.service import (
        validate_condition_effect_definition,
    )
    from backend.features.sheet_admin.items.service import (
        validate_item_effect_definition,
    )

    validate_standalone = any(
        isinstance(step, ApplyAugmentationStep)
        and step.augmentation_id == definition.id
        for action in state.actions.values()
        for step in action.steps
    ) or any(
        application.definition_id == definition.id
        for application in state.standalone_effect_applications.values()
    )
    if validate_standalone:
        augmentation_service.validate_standalone_runtime_definition(definition)

    for item in (*state.items.values(), *state.item_templates.values()):
        if definition.id in item.effect_ids:
            validate_item_effect_definition(definition, item=item, state=state)
    for condition in state.condition_presets.values():
        if definition.id in condition.effect_ids:
            validate_condition_effect_definition(definition, state)


async def create_standalone_effect(request: CreateStandaloneEffect) -> None:
    def mutation(state: State) -> tuple[None, list]:
        definition = _build_definition(request.effect, state)
        if definition.id in state.standalone_effects:
            raise ValueError(f"Standalone effect '{definition.id}' already exists.")
        definition, formula_ops = _centralize_effect_formula(definition, state)
        validate_effect_definition_references(definition, state)
        op = state_sync_service.add_mutation(
            state,
            state_sync_service.join_path("standalone_effects", definition.id),
            definition,
        )
        return None, [*formula_ops, op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def update_standalone_effect(request: UpdateStandaloneEffect) -> None:
    if request.effect.id != request.effect_id:
        raise ValueError("Standalone effect ID cannot be changed.")
    def mutation(state: State) -> tuple[None, list]:
        definition = _build_definition(request.effect, state)
        if request.effect_id not in state.standalone_effects:
            raise ValueError(
                f"Standalone effect '{request.effect_id}' does not exist."
            )
        definition, formula_ops = _centralize_effect_formula(definition, state)
        validate_effect_definition_references(definition, state)
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
        return None, [*formula_ops, op, *projection_ops]

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
        referencing_items = sorted({
            item.id
            for item in (*state.items.values(), *state.item_templates.values())
            if request.effect_id in item.effect_ids
        })
        if referencing_items:
            raise ValueError(
                f"Effect '{request.effect_id}' is referenced by items or item "
                f"templates: {', '.join(referencing_items)}."
            )
        referencing_conditions = sorted(
            condition.id
            for condition in state.condition_presets.values()
            if request.effect_id in condition.effect_ids
        )
        if referencing_conditions:
            raise ValueError(
                f"Effect '{request.effect_id}' is referenced by conditions: "
                + ", ".join(referencing_conditions)
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
