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
from backend.state.models.formula import FormulaReference
from backend.state.models.augmentation import (
    EvaluationFormulaModifierEffect,
    FormulaModifierEffect,
)
from backend.state.models.state import State
from backend.state.models.tag import validate_tag_ids


def _format_path(path: list[str]) -> str:
    return ".".join(path)


def _valid_formula_paths(state: State | None = None) -> set[tuple[str, ...]]:
    registry = variable_registry_service.build_action_formula_authoring_metadata(
        state=state
    )
    paths: set[tuple[str, ...]] = set()
    for variable in registry.variables:
        if not variable.formula_reference_allowed:
            continue
        # Existing sheet/Attribute formulas are subject-relative. Action authoring uses
        # explicit roots from the metadata picker. Accept both representations.
        paths.add(tuple(variable.path))
        paths.add((variable.root, *variable.path))
    return paths


def _validate_alias_paths(
    aliases: list[tuple[str, list[str]]],
    *,
    additional_paths: set[tuple[str, ...]] | None = None,
    state: State | None = None,
) -> None:
    valid_paths = _valid_formula_paths(state) | (additional_paths or set())
    for alias_name, path in aliases:
        alias_path = tuple(path)
        if (
            len(path) == 2
            and path[0] == "action_values"
            and path[1]
        ):
            continue
        if alias_path not in valid_paths:
            raise ValueError(
                "Formula alias "
                f"'{alias_name}' references unsupported path "
                f"'{_format_path(path)}'."
            )


def validate_formula_payload_paths(
    formula: FormulaPayload,
    *,
    additional_paths: set[tuple[str, ...]] | None = None,
    state: State | None = None,
) -> None:
    _validate_alias_paths(
        [(alias.name, list(alias.path)) for alias in formula.aliases or []],
        additional_paths=additional_paths,
        state=state,
    )


def validate_formula_alias_paths(
    formula: Formula,
    *,
    additional_paths: set[tuple[str, ...]] | None = None,
    state: State | None = None,
) -> None:
    _validate_alias_paths(
        [(alias.name, list(alias.path)) for alias in formula.aliases or []],
        additional_paths=additional_paths,
        state=state,
    )


def build_formula(
    payload: FormulaPayload,
    *,
    additional_paths: set[tuple[str, ...]] | None = None,
) -> Formula:
    validate_formula_payload_paths(payload, additional_paths=additional_paths)
    aliases = None
    if payload.aliases is not None:
        aliases = [
            FormulaAliases(name=alias.name, path=list(alias.path))
            for alias in payload.aliases
        ]
    return Formula(aliases=aliases, text=payload.text, tags=list(payload.tags))


def _build_formula_definition(payload: FormulaDefinitionPayload) -> FormulaDefinition:
    validate_formula_payload_paths(payload.formula)
    return FormulaDefinition(id=payload.id, formula=build_formula(payload.formula))


def _formulas_state(state: State) -> dict[str, dict]:
    return state.formulas


def _attribute_formula_references(state: State, formula_id: str) -> list[str]:
    references: list[str] = []
    for attribute_id, definition in state.attributes.items():
        if (
            definition.default_value.type == "formula"
            and isinstance(definition.default_value.formula, FormulaReference)
            and definition.default_value.formula.formula_id == formula_id
        ):
            references.append(f"attribute definition {attribute_id}")
    for registry_name, registry in (
        ("sheet", state.sheets),
        ("instance", state.instanced_sheets),
        ("item", state.items),
        ("item template", state.item_templates),
        ("action", state.actions),
    ):
        for owner_id, owner in registry.items():
            if any(
                bridge.value.type == "formula"
                and isinstance(bridge.value.formula, FormulaReference)
                and bridge.value.formula.formula_id == formula_id
                for bridge in owner.attributes.values()
            ):
                references.append(f"{registry_name} {owner_id}")
    return references


def _effect_formula_references(state: State, formula_id: str) -> list[str]:
    return sorted(
        effect_id
        for effect_id, definition in state.standalone_effects.items()
        if isinstance(
            definition.effect,
            FormulaModifierEffect | EvaluationFormulaModifierEffect,
        )
        and isinstance(definition.effect.value, FormulaReference)
        and definition.effect.value.formula_id == formula_id
    )


def validate_formula_definition_references(
    definition: FormulaDefinition,
    state: State,
) -> None:
    """Revalidate every consumer before a shared definition is changed."""
    candidate = deepcopy(state)
    candidate.formulas[definition.id] = definition

    from backend.features.attributes.service import (
        validate_attribute_value,
    )
    from backend.features.sheet_admin.actions.schema import ActionDefinitionPayload
    from backend.features.sheet_admin.actions.service import _validate_action_payload
    from backend.features.standalone_effects.service import (
        validate_effect_definition_references,
    )

    for attribute_id, attribute in candidate.attributes.items():
        if (
            attribute.default_value.type == "formula"
            and isinstance(attribute.default_value.formula, FormulaReference)
            and attribute.default_value.formula.formula_id == definition.id
        ):
            validate_attribute_value(
                attribute,
                attribute.default_value,
                state=candidate,
                subject_types=attribute.subject_types,
            )

    for subject_type, registry in (
        ("sheet", candidate.sheets),
        ("sheet", candidate.instanced_sheets),
        ("item", candidate.items),
        ("item", candidate.item_templates),
        ("action", candidate.actions),
    ):
        for subject in registry.values():
            for attribute_id, bridge in subject.attributes.items():
                if not (
                    bridge.value.type == "formula"
                    and isinstance(bridge.value.formula, FormulaReference)
                    and bridge.value.formula.formula_id == definition.id
                ):
                    continue
                validate_attribute_value(
                    candidate.attributes[attribute_id],
                    bridge.value,
                    state=candidate,
                    subject_types=[subject_type],
                    attached_attribute_ids=set(subject.attributes),
                )

    for action in candidate.actions.values():
        if definition.id not in action.referenced_formula_ids():
            continue
        payload = ActionDefinitionPayload.model_validate(asdict(action))
        _validate_action_payload(payload, candidate)

    for effect in candidate.standalone_effects.values():
        if effect.id in _effect_formula_references(candidate, definition.id):
            validate_effect_definition_references(effect, candidate)


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
        validate_tag_ids(formula.formula.tags, state.tags)
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
        validate_tag_ids(formula.formula.tags, state.tags)
        validate_formula_definition_references(formula, state)
        path = state_sync_service.join_path("formulas", formula_id)
        op = state_sync_service.set_mutation(state, path, formula)
        from backend.features.attributes.service import (
            reevaluate_all_attribute_consumers_mutations,
        )

        attribute_ops = reevaluate_all_attribute_consumers_mutations(state)
        return None, [op, *attribute_ops]

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
        referencing_actions = sorted(
            action_id
            for action_id, action in state.actions.items()
            if formula_id in action.referenced_formula_ids()
        )
        if referencing_actions:
            action_ids = ", ".join(referencing_actions)
            raise ValueError(
                f"Formula '{formula_id}' is referenced by actions: {action_ids}."
            )
        attribute_references = sorted(_attribute_formula_references(state, formula_id))
        if attribute_references:
            raise ValueError(
                f"Formula '{formula_id}' is referenced by Attributes: "
                + ", ".join(attribute_references)
                + "."
            )
        effect_references = _effect_formula_references(state, formula_id)
        if effect_references:
            raise ValueError(
                f"Formula '{formula_id}' is referenced by effects: "
                + ", ".join(effect_references)
                + "."
            )

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
