from __future__ import annotations

from copy import deepcopy

from backend.core.transport import PatchOp
from backend.features.facts.schema import (
    AttachSheetFact,
    AttachSubjectFact,
    CreateFact,
    DeleteFact,
    DetachSheetFact,
    DetachSubjectFact,
    ResetSubjectFactValue,
    ResetSheetFactValue,
    SetSheetFactValue,
    SetSubjectFactValue,
    UpdateFact,
)
from backend.features.variable_registry import service as variable_registry_service
from backend.features.state_sync.service import state_sync_service
from backend.features.facts.value_schema import (
    FactDefinitionPayload,
    FactValuePayload,
    FormulaFactValuePayload,
)
from backend.state.models.fact import (
    ACTION_BASE_SPELL_DAMAGE_FACT_ID,
    ACTION_MANA_COST_FACT_ID,
    ACTION_RANGE_FACT_ID,
    ACTION_TARGET_COUNT_FACT_ID,
    AMOUNT_OF_REACTIONS_FACT_ID,
    WEAPON_BASE_DAMAGE_FACT_ID,
    WEAPON_DAMAGE_TYPES_FACT_ID,
    WEAPON_PROFICIENCY_GROWTH_RATE_FACT_ID,
    WEAPON_REACH_FACT_ID,
    WEAPON_TYPE_FACT_ID,
    FactBridge,
    FactDefinition,
    FactValue,
    require_valid_subject_fact_evaluation,
    synchronize_all_sheet_facts,
    evaluate_all_subject_facts,
    synchronize_required_sheet_facts,
    validate_sheet_formula_dependencies,
)
from backend.state.models.formula import Formula, FormulaAliases
from backend.state.models.sheet import Sheet
from backend.state.models.state import State


def _build_fact_value(
    payload: FactValuePayload,
) -> FactValue:
    if isinstance(payload, FormulaFactValuePayload):
        return FactValue(
            type="formula",
            formula=Formula(
                aliases=(
                    None
                    if payload.formula.aliases is None
                    else [
                        FormulaAliases(name=alias.name, path=list(alias.path))
                        for alias in payload.formula.aliases
                    ]
                ),
                text=payload.formula.text,
                tags=list(payload.formula.tags),
            ),
        )
    raw = payload.model_dump(mode="python")
    return FactValue(type=raw["type"], value=raw["value"])


def build_fact_value(
    payload: FactValuePayload,
    *,
    fact_ids: set[str] | None = None,
) -> FactValue:
    return _build_fact_value(payload, fact_ids=fact_ids)


REFERENCE_COLLECTIONS = {
    "proficiency": "proficiencies",
    "item": "items",
    "action": "actions",
    "sheet": "sheets",
}


def _fact_formula_paths(
    state: State,
    subject_type: str,
) -> set[tuple[str, ...]]:
    paths = {
        ("facts", definition.id)
        for definition in state.facts.values()
        if definition.value_type == "number"
        and subject_type in definition.subject_types
    }
    if subject_type == "sheet":
        paths.update(
            tuple(variable.path)
            for variable in variable_registry_service.build_variable_registry().variables
            if variable.root == "sheet"
            and variable.value_type in {"number", "percent", "formula"}
        )
    return paths


def validate_fact_formula_paths(
    state: State,
    formula: Formula,
    *,
    subject_types: list[str],
    attached_fact_ids: set[str] | None = None,
) -> None:
    for alias in formula.aliases or []:
        path = tuple(alias.path)
        unsupported_subjects = [
            subject_type
            for subject_type in subject_types
            if path not in _fact_formula_paths(state, subject_type)
        ]
        if unsupported_subjects:
            raise ValueError(
                f"Fact formula alias '{alias.name}' references unsupported path "
                f"'{'.'.join(alias.path)}' for subject type(s): "
                + ", ".join(unsupported_subjects)
                + "."
            )
        if (
            attached_fact_ids is not None
            and len(alias.path) == 2
            and alias.path[0] == "facts"
            and alias.path[1] not in attached_fact_ids
        ):
            raise ValueError(
                f"Fact formula alias '{alias.name}' references Fact "
                f"'{alias.path[1]}', but it is not attached to this subject."
            )


def validate_fact_value(
    definition: FactDefinition,
    value: FactValue,
    *,
    state: State | None = None,
    subject_types: list[str] | None = None,
    attached_fact_ids: set[str] | None = None,
) -> None:
    actual_type = "number" if value.type == "formula" else value.type
    if actual_type != definition.value_type:
        raise ValueError(
            f"Fact '{definition.id}' requires a {definition.value_type} value, "
            f"not {value.type}."
        )
    if value.type in {"enum", "reference"} and definition.validation_options:
        if value.value not in definition.validation_options:
            raise ValueError(
                f"Fact '{definition.id}' value must be one of: "
                + ", ".join(definition.validation_options)
                + "."
            )
    if value.type == "reference" and definition.reference_kind:
        collection_name = REFERENCE_COLLECTIONS.get(definition.reference_kind)
        if collection_name is None:
            raise ValueError(
                f"Fact '{definition.id}' uses unsupported reference kind "
                f"'{definition.reference_kind}'."
            )
        if state is not None and value.value not in getattr(state, collection_name):
            raise ValueError(
                f"Fact '{definition.id}' references missing "
                f"{definition.reference_kind} '{value.value}'."
            )
    if value.type == "list" and definition.validation_options:
        invalid = [
            entry
            for entry in value.value or []
            if entry not in definition.validation_options
        ]
        if invalid:
            raise ValueError(
                f"Fact '{definition.id}' contains unsupported values: "
                + ", ".join(invalid)
                + "."
            )
    if value.type == "formula" and value.formula is not None:
        if state is None or subject_types is None:
            raise ValueError("Formula Fact validation requires an authoritative subject scope.")
        validate_fact_formula_paths(
            state,
            value.formula,
            subject_types=subject_types,
            attached_fact_ids=attached_fact_ids,
        )


def validate_subject_fact_value(
    state: State,
    subject_type: str,
    subject: object,
    definition: FactDefinition,
    value: FactValue,
    *,
    attached_fact_ids: set[str] | None = None,
) -> None:
    validate_fact_value(
        definition,
        value,
        state=state,
        subject_types=[subject_type],
        attached_fact_ids=(
            set(getattr(subject, "facts", {}))
            if attached_fact_ids is None
            else attached_fact_ids
        ),
    )
    if subject_type != "item" or getattr(subject, "fact_profile", None) != "weapon":
        if subject_type == "action":
            if definition.id in {
                ACTION_RANGE_FACT_ID,
                ACTION_MANA_COST_FACT_ID,
                ACTION_BASE_SPELL_DAMAGE_FACT_ID,
            } and (
                not isinstance(value.value, (int, float))
                or isinstance(value.value, bool)
                or value.value < 0
            ):
                raise ValueError(f"Action Fact '{definition.id}' must be nonnegative.")
            if definition.id == ACTION_TARGET_COUNT_FACT_ID and (
                not isinstance(value.value, (int, float))
                or isinstance(value.value, bool)
                or value.value < 1
                or int(value.value) != value.value
            ):
                raise ValueError("Action Target Count must be a positive whole number.")
        return
    if definition.id == WEAPON_TYPE_FACT_ID:
        if not isinstance(value.value, str) or not value.value.strip():
            raise ValueError("Weapon Type is required.")
    if definition.id == WEAPON_DAMAGE_TYPES_FACT_ID:
        if not isinstance(value.value, list) or not value.value:
            raise ValueError("At least one physical weapon damage type is required.")
    if definition.id in {
        WEAPON_BASE_DAMAGE_FACT_ID,
        WEAPON_REACH_FACT_ID,
        WEAPON_PROFICIENCY_GROWTH_RATE_FACT_ID,
    }:
        if (
            not isinstance(value.value, (int, float))
            or isinstance(value.value, bool)
            or value.value < 0
        ):
            raise ValueError(f"Weapon Fact '{definition.id}' must be nonnegative.")


def _fact_references(state: State, fact_id: str) -> list[tuple[str, str, object]]:
    references: list[tuple[str, str, object]] = []
    references.extend(
        ("sheets", sheet.id, sheet)
        for sheet in state.sheets.values()
        if fact_id in sheet.facts
    )
    references.extend(
        ("items", item.id, item)
        for item in state.items.values()
        if fact_id in item.facts
    )
    references.extend(
        ("actions", action.id, action)
        for action in state.actions.values()
        if fact_id in action.facts
    )
    return references


def _required_sheet_and_definition(
    state: State,
    sheet_id: str,
    fact_id: str,
) -> tuple[Sheet, FactDefinition, FactBridge]:
    sheet = state.sheets.get(sheet_id)
    if sheet is None:
        raise ValueError(f"Sheet '{sheet_id}' does not exist.")
    definition = state.facts.get(fact_id)
    if definition is None or "sheet" not in definition.subject_types:
        raise ValueError(f"Sheet Fact '{fact_id}' does not exist.")
    if AMOUNT_OF_REACTIONS_FACT_ID not in sheet.facts:
        synchronize_required_sheet_facts(sheet)
    bridge = sheet.facts.get(fact_id)
    if bridge is None:
        raise ValueError(f"Fact '{fact_id}' is not attached to sheet '{sheet_id}'.")
    return sheet, definition, bridge


def _build_definition(
    payload: FactDefinitionPayload,
    *,
    state: State,
) -> FactDefinition:
    if not payload.subject_types:
        raise ValueError("A Fact must allow at least one subject type.")
    if payload.value_type in {"enum", "list"}:
        if not payload.validation_options:
            raise ValueError(
                f"{payload.value_type.title()} Facts require validation options."
            )
    if payload.value_type == "reference" and not payload.reference_kind:
        raise ValueError("Reference Facts require a reference kind.")
    if (
        payload.value_type == "reference"
        and payload.reference_kind not in REFERENCE_COLLECTIONS
    ):
        raise ValueError(
            f"Unsupported Fact reference kind '{payload.reference_kind}'."
        )
    value = _build_fact_value(payload.default_value)
    if value.type == "formula" and any(
        alias.path == ["facts", payload.id]
        for alias in value.formula.aliases or []
    ):
        raise ValueError(f"Fact '{payload.id}' default formula cannot reference itself.")
    definition = FactDefinition(
        id=payload.id,
        name=payload.name,
        description=payload.description,
        subject_types=list(payload.subject_types),
        value_type=payload.value_type,
        default_value=value,
        unit=payload.unit,
        visibility=payload.visibility,
        validation_options=list(payload.validation_options),
        reference_kind=payload.reference_kind,
        required=False,
        required_profile=None,
        backend_owned=False,
    )
    validate_fact_value(
        definition,
        value,
        state=state,
        subject_types=list(definition.subject_types),
    )
    return definition


def _apply_candidate_sheet_facts(
    state: State,
    sheet_id: str,
    candidate: Sheet,
) -> list[PatchOp]:
    sheet = state.sheets[sheet_id]
    operations: list[PatchOp] = []
    for fact_id in sorted(set(sheet.facts) | set(candidate.facts)):
        path = state_sync_service.join_path("sheets", sheet_id, "facts", fact_id)
        current = sheet.facts.get(fact_id)
        updated = candidate.facts.get(fact_id)
        if current == updated:
            continue
        if current is None and updated is not None:
            operations.append(state_sync_service.add_mutation(state, path, updated))
        elif updated is None:
            _, operation = state_sync_service.remove_mutation(state, path)
            operations.append(operation)
        else:
            operations.append(state_sync_service.set_mutation(state, path, updated))
    return operations


def _subject_collection(state: State, subject_type: str) -> dict:
    return state.items if subject_type == "item" else state.actions


def _subject_and_definition(
    state: State,
    subject_type: str,
    subject_id: str,
    fact_id: str,
) -> tuple[object, FactDefinition, FactBridge | None]:
    subject = _subject_collection(state, subject_type).get(subject_id)
    if subject is None:
        raise ValueError(f"{subject_type.title()} '{subject_id}' does not exist.")
    definition = state.facts.get(fact_id)
    if definition is None or subject_type not in definition.subject_types:
        raise ValueError(
            f"{subject_type.title()} Fact '{fact_id}' does not exist."
        )
    if (
        subject_type == "item"
        and definition.required_profile is not None
        and subject.fact_profile != definition.required_profile
    ):
        raise ValueError(
            f"Fact '{fact_id}' requires item profile "
            f"'{definition.required_profile}'."
        )
    return subject, definition, subject.facts.get(fact_id)


def _apply_candidate_subject_facts(
    state: State,
    subject_type: str,
    subject_id: str,
    candidate: object,
) -> list[PatchOp]:
    subject = _subject_collection(state, subject_type)[subject_id]
    operations: list[PatchOp] = []
    for fact_id in sorted(set(subject.facts) | set(candidate.facts)):
        path = state_sync_service.join_path(
            f"{subject_type}s", subject_id, "facts", fact_id
        )
        current = subject.facts.get(fact_id)
        updated = candidate.facts.get(fact_id)
        if current == updated:
            continue
        if current is None and updated is not None:
            operations.append(state_sync_service.add_mutation(state, path, updated))
        elif updated is None:
            _, operation = state_sync_service.remove_mutation(state, path)
            operations.append(operation)
        else:
            operations.append(state_sync_service.set_mutation(state, path, updated))
    return operations


def reevaluate_sheet_facts_mutations(
    state: State,
    sheet_id: str,
) -> list[PatchOp]:
    sheet = state.sheets.get(sheet_id)
    if sheet is None:
        raise ValueError(f"Sheet '{sheet_id}' does not exist.")
    candidate = deepcopy(sheet)
    synchronize_all_sheet_facts(candidate)
    return _apply_candidate_sheet_facts(state, sheet_id, candidate)


def validate_and_evaluate_sheet_facts(
    sheet: Sheet,
    fact_ids: set[str] | None = None,
) -> None:
    validate_sheet_formula_dependencies(sheet)
    synchronize_all_sheet_facts(sheet)
    require_valid_subject_fact_evaluation(sheet, fact_ids)


def validate_and_evaluate_subject_facts(subject: object) -> None:
    evaluate_all_subject_facts(subject)
    require_valid_subject_fact_evaluation(subject)


async def create_fact(request: CreateFact) -> None:
    if (
        request.fact.required
        or request.fact.required_profile is not None
        or request.fact.backend_owned
    ):
        raise ValueError("Required Fact metadata is backend-owned.")

    def mutation(state: State) -> tuple[None, list]:
        if request.fact.id in state.facts:
            raise ValueError(f"Fact '{request.fact.id}' already exists.")
        definition = _build_definition(request.fact, state=state)
        path = state_sync_service.join_path("facts", definition.id)
        return None, [state_sync_service.add_mutation(state, path, definition)]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def update_fact(request: UpdateFact) -> None:
    if request.fact.id != request.fact_id:
        raise ValueError("Fact ID cannot be changed.")

    def mutation(state: State) -> tuple[None, list]:
        current = state.facts.get(request.fact_id)
        if current is None:
            raise ValueError(f"Fact '{request.fact_id}' does not exist.")
        if current.backend_owned:
            raise ValueError("Backend-owned Fact definitions cannot be changed.")
        if (
            request.fact.required
            or request.fact.required_profile is not None
            or request.fact.backend_owned
        ):
            raise ValueError("Required Fact metadata is backend-owned.")
        definition = _build_definition(request.fact, state=state)
        fact_references = _fact_references(state, request.fact_id)
        for root, _, subject in fact_references:
            subject_type = "sheet" if root == "sheets" else root.removesuffix("s")
            validate_subject_fact_value(
                state,
                subject_type,
                subject,
                definition,
                subject.facts[request.fact_id].value,
            )
        referencing_subjects = [
            sheet.id
            for sheet in state.sheets.values()
            if request.fact_id in sheet.facts
        ]
        if referencing_subjects and "sheet" not in definition.subject_types:
            raise ValueError(
                f"Fact '{request.fact_id}' is attached to sheets: "
                + ", ".join(sorted(referencing_subjects))
                + "."
            )
        for subject_type, collection in (
            ("item", state.items),
            ("action", state.actions),
        ):
            subject_references = sorted(
                subject.id
                for subject in collection.values()
                if request.fact_id in subject.facts
            )
            if subject_references and subject_type not in definition.subject_types:
                raise ValueError(
                    f"Fact '{request.fact_id}' is attached to {subject_type}s: "
                    + ", ".join(subject_references)
                    + "."
                )
        path = state_sync_service.join_path("facts", request.fact_id)
        operations = [state_sync_service.set_mutation(state, path, definition)]
        if current.visibility != definition.visibility:
            for root, subject_id, subject in fact_references:
                bridge_path = state_sync_service.join_path(
                    root,
                    subject_id,
                    "facts",
                    request.fact_id,
                )
                operations.append(
                    state_sync_service.set_mutation(
                        state,
                        bridge_path,
                        subject.facts[request.fact_id],
                    )
                )
        return None, operations

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def delete_fact(request: DeleteFact) -> None:
    def mutation(state: State) -> tuple[None, list]:
        definition = state.facts.get(request.fact_id)
        if definition is None:
            raise ValueError(f"Fact '{request.fact_id}' does not exist.")
        if definition.backend_owned:
            raise ValueError("Backend-owned Fact definitions cannot be deleted.")
        referencing_sheets = sorted(
            sheet.id
            for sheet in state.sheets.values()
            if request.fact_id in sheet.facts
        )
        if referencing_sheets:
            raise ValueError(
                f"Fact '{request.fact_id}' is attached to sheets: "
                + ", ".join(referencing_sheets)
                + "."
            )
        for subject_type, collection in (
            ("items", state.items),
            ("actions", state.actions),
        ):
            references = sorted(
                subject.id
                for subject in collection.values()
                if request.fact_id in subject.facts
            )
            if references:
                raise ValueError(
                    f"Fact '{request.fact_id}' is attached to {subject_type}: "
                    + ", ".join(references)
                    + "."
                )
        path = state_sync_service.join_path("facts", request.fact_id)
        _, operation = state_sync_service.remove_mutation(state, path)
        return None, [operation]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def attach_sheet_fact(request: AttachSheetFact) -> None:
    def mutation(state: State) -> tuple[None, list]:
        sheet = state.sheets.get(request.sheet_id)
        if sheet is None:
            raise ValueError(f"Sheet '{request.sheet_id}' does not exist.")
        definition = state.facts.get(request.fact_id)
        if definition is None or "sheet" not in definition.subject_types:
            raise ValueError(f"Sheet Fact '{request.fact_id}' does not exist.")
        if request.fact_id in sheet.facts:
            raise ValueError(
                f"Fact '{request.fact_id}' is already attached to sheet '{request.sheet_id}'."
            )
        if any(
            bridge.relationship_id == request.relationship_id
            for bridge in sheet.facts.values()
        ):
            raise ValueError(
                f"Fact relationship '{request.relationship_id}' already exists."
            )
        value = (
            _build_fact_value(request.value)
            if request.value is not None
            else deepcopy(definition.default_value)
        )
        validate_subject_fact_value(
            state,
            "sheet",
            sheet,
            definition,
            value,
            attached_fact_ids={*sheet.facts, request.fact_id},
        )
        candidate = deepcopy(sheet)
        candidate.facts[request.fact_id] = FactBridge(
            relationship_id=request.relationship_id,
            fact_id=request.fact_id,
            value=value,
        )
        validate_and_evaluate_sheet_facts(candidate)
        return None, _apply_candidate_sheet_facts(state, request.sheet_id, candidate)

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def detach_sheet_fact(request: DetachSheetFact) -> None:
    def mutation(state: State) -> tuple[None, list]:
        sheet, definition, _ = _required_sheet_and_definition(
            state, request.sheet_id, request.fact_id
        )
        if definition.required:
            raise ValueError("Required Facts cannot be detached.")
        candidate = deepcopy(sheet)
        candidate.facts.pop(request.fact_id)
        validate_and_evaluate_sheet_facts(candidate)
        return None, _apply_candidate_sheet_facts(state, request.sheet_id, candidate)

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def attach_subject_fact(request: AttachSubjectFact) -> None:
    def mutation(state: State) -> tuple[None, list]:
        subject, definition, bridge = _subject_and_definition(
            state,
            request.subject_type,
            request.subject_id,
            request.fact_id,
        )
        if bridge is not None:
            raise ValueError(
                f"Fact '{request.fact_id}' is already attached to "
                f"{request.subject_type} '{request.subject_id}'."
            )
        if any(
            current.relationship_id == request.relationship_id
            for current in subject.facts.values()
        ):
            raise ValueError(
                f"Fact relationship '{request.relationship_id}' already exists."
            )
        value = (
            _build_fact_value(request.value)
            if request.value is not None
            else deepcopy(definition.default_value)
        )
        validate_subject_fact_value(
            state,
            request.subject_type,
            subject,
            definition,
            value,
            attached_fact_ids={*subject.facts, request.fact_id},
        )
        candidate = deepcopy(subject)
        candidate.facts[request.fact_id] = FactBridge(
            relationship_id=request.relationship_id,
            fact_id=request.fact_id,
            value=value,
        )
        validate_and_evaluate_subject_facts(candidate)
        return None, _apply_candidate_subject_facts(
            state, request.subject_type, request.subject_id, candidate
        )

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def set_subject_fact_value(request: SetSubjectFactValue) -> None:
    def mutation(state: State) -> tuple[None, list]:
        subject, definition, bridge = _subject_and_definition(
            state,
            request.subject_type,
            request.subject_id,
            request.fact_id,
        )
        if bridge is None:
            raise ValueError(f"Fact '{request.fact_id}' is not attached.")
        value = _build_fact_value(request.value)
        validate_subject_fact_value(
            state,
            request.subject_type,
            subject,
            definition,
            value,
        )
        candidate = deepcopy(subject)
        candidate.facts[request.fact_id].value = value
        validate_and_evaluate_subject_facts(candidate)
        return None, _apply_candidate_subject_facts(
            state, request.subject_type, request.subject_id, candidate
        )

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def reset_subject_fact_value(request: ResetSubjectFactValue) -> None:
    def mutation(state: State) -> tuple[None, list]:
        subject, definition, bridge = _subject_and_definition(
            state,
            request.subject_type,
            request.subject_id,
            request.fact_id,
        )
        if bridge is None:
            raise ValueError(f"Fact '{request.fact_id}' is not attached.")
        validate_subject_fact_value(
            state,
            request.subject_type,
            subject,
            definition,
            definition.default_value,
        )
        candidate = deepcopy(subject)
        candidate.facts[request.fact_id].value = deepcopy(definition.default_value)
        validate_and_evaluate_subject_facts(candidate)
        return None, _apply_candidate_subject_facts(
            state, request.subject_type, request.subject_id, candidate
        )

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def detach_subject_fact(request: DetachSubjectFact) -> None:
    def mutation(state: State) -> tuple[None, list]:
        subject, definition, bridge = _subject_and_definition(
            state,
            request.subject_type,
            request.subject_id,
            request.fact_id,
        )
        if bridge is None:
            raise ValueError(f"Fact '{request.fact_id}' is not attached.")
        if definition.required:
            raise ValueError("Required Facts cannot be detached.")
        candidate = deepcopy(subject)
        candidate.facts.pop(request.fact_id)
        validate_and_evaluate_subject_facts(candidate)
        return None, _apply_candidate_subject_facts(
            state, request.subject_type, request.subject_id, candidate
        )

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def set_sheet_fact_value(request: SetSheetFactValue) -> None:
    def mutation(state: State) -> tuple[None, list]:
        sheet, definition, _ = _required_sheet_and_definition(
            state,
            request.sheet_id,
            request.fact_id,
        )
        value = _build_fact_value(request.value)
        validate_subject_fact_value(
            state,
            "sheet",
            sheet,
            definition,
            value,
        )
        candidate = deepcopy(sheet)
        candidate.facts[request.fact_id].value = deepcopy(value)
        validate_and_evaluate_sheet_facts(candidate)
        return None, _apply_candidate_sheet_facts(state, request.sheet_id, candidate)

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def reset_sheet_fact_value(request: ResetSheetFactValue) -> None:
    def mutation(state: State) -> tuple[None, list]:
        sheet, definition, _ = _required_sheet_and_definition(
            state,
            request.sheet_id,
            request.fact_id,
        )
        candidate = deepcopy(sheet)
        candidate.facts[request.fact_id].value = deepcopy(definition.default_value)
        validate_and_evaluate_sheet_facts(candidate)
        return None, _apply_candidate_sheet_facts(state, request.sheet_id, candidate)

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)
