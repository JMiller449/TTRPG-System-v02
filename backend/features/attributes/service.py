from __future__ import annotations

from copy import deepcopy

from backend.core.transport import PatchOp
from backend.features.attributes.schema import (
    AttachSheetAttribute,
    AttachInstancedSheetAttribute,
    AttachSubjectAttribute,
    CreateAttribute,
    DeleteAttribute,
    DetachSheetAttribute,
    DetachInstancedSheetAttribute,
    DetachSubjectAttribute,
    ResetSubjectAttributeValue,
    ResetSheetAttributeValue,
    ResetInstancedSheetAttributeValue,
    SetSheetAttributeValue,
    SetInstancedSheetAttributeValue,
    SetSubjectAttributeValue,
    UpdateAttribute,
)
from backend.features.variable_registry import service as variable_registry_service
from backend.features.state_sync.service import state_sync_service
from backend.features.attributes.value_schema import (
    AttributeDefinitionPayload,
    AttributeValuePayload,
    FormulaAttributeValuePayload,
)
from backend.state.models.attribute import (
    ACTION_BASE_SPELL_DAMAGE_ATTRIBUTE_ID,
    ACTION_MANA_COST_ATTRIBUTE_ID,
    ACTION_RANGE_ATTRIBUTE_ID,
    ACTION_TARGET_COUNT_ATTRIBUTE_ID,
    AMOUNT_OF_REACTIONS_ATTRIBUTE_ID,
    WEAPON_BASE_DAMAGE_ATTRIBUTE_ID,
    WEAPON_DAMAGE_TYPES_ATTRIBUTE_ID,
    WEAPON_PROFICIENCY_GROWTH_RATE_ATTRIBUTE_ID,
    WEAPON_REACH_ATTRIBUTE_ID,
    WEAPON_TYPE_ATTRIBUTE_ID,
    AttributeBridge,
    AttributeDefinition,
    AttributeValue,
    require_valid_subject_attribute_evaluation,
    synchronize_all_sheet_attributes,
    evaluate_all_subject_attributes,
    synchronize_required_sheet_attributes,
    validate_sheet_formula_dependencies,
)
from backend.state.models.formula import Formula, FormulaAliases
from backend.state.models.sheet import Sheet
from backend.state.models.state import State


def _build_attribute_value(
    payload: AttributeValuePayload,
) -> AttributeValue:
    if isinstance(payload, FormulaAttributeValuePayload):
        return AttributeValue(
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
    return AttributeValue(type=raw["type"], value=raw["value"])


def build_attribute_value(
    payload: AttributeValuePayload,
    *,
    attribute_ids: set[str] | None = None,
) -> AttributeValue:
    return _build_attribute_value(payload)


REFERENCE_COLLECTIONS = {
    "proficiency": "proficiencies",
    "item": "items",
    "action": "actions",
    "sheet": "sheets",
}


def _attribute_formula_paths(
    state: State,
    subject_type: str,
) -> set[tuple[str, ...]]:
    paths = {
        ("attributes", definition.id)
        for definition in state.attributes.values()
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


def validate_attribute_formula_paths(
    state: State,
    formula: Formula,
    *,
    subject_types: list[str],
    attached_attribute_ids: set[str] | None = None,
) -> None:
    for alias in formula.aliases or []:
        path = tuple(alias.path)
        unsupported_subjects = [
            subject_type
            for subject_type in subject_types
            if path not in _attribute_formula_paths(state, subject_type)
        ]
        if unsupported_subjects:
            raise ValueError(
                f"Attribute formula alias '{alias.name}' references unsupported path "
                f"'{'.'.join(alias.path)}' for subject type(s): "
                + ", ".join(unsupported_subjects)
                + "."
            )
        if (
            attached_attribute_ids is not None
            and len(alias.path) == 2
            and alias.path[0] == "attributes"
            and alias.path[1] not in attached_attribute_ids
        ):
            raise ValueError(
                f"Attribute formula alias '{alias.name}' references Attribute "
                f"'{alias.path[1]}', but it is not attached to this subject."
            )


def validate_attribute_value(
    definition: AttributeDefinition,
    value: AttributeValue,
    *,
    state: State | None = None,
    subject_types: list[str] | None = None,
    attached_attribute_ids: set[str] | None = None,
) -> None:
    actual_type = "number" if value.type == "formula" else value.type
    if actual_type != definition.value_type:
        raise ValueError(
            f"Attribute '{definition.id}' requires a {definition.value_type} value, "
            f"not {value.type}."
        )
    if value.type in {"enum", "reference"} and definition.validation_options:
        if value.value not in definition.validation_options:
            raise ValueError(
                f"Attribute '{definition.id}' value must be one of: "
                + ", ".join(definition.validation_options)
                + "."
            )
    if value.type == "reference" and definition.reference_kind:
        collection_name = REFERENCE_COLLECTIONS.get(definition.reference_kind)
        if collection_name is None:
            raise ValueError(
                f"Attribute '{definition.id}' uses unsupported reference kind "
                f"'{definition.reference_kind}'."
            )
        if state is not None and value.value not in getattr(state, collection_name):
            raise ValueError(
                f"Attribute '{definition.id}' references missing "
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
                f"Attribute '{definition.id}' contains unsupported values: "
                + ", ".join(invalid)
                + "."
            )
    if value.type == "formula" and value.formula is not None:
        if state is None or subject_types is None:
            raise ValueError("Formula Attribute validation requires an authoritative subject scope.")
        validate_attribute_formula_paths(
            state,
            value.formula,
            subject_types=subject_types,
            attached_attribute_ids=attached_attribute_ids,
        )


def validate_subject_attribute_value(
    state: State,
    subject_type: str,
    subject: object,
    definition: AttributeDefinition,
    value: AttributeValue,
    *,
    attached_attribute_ids: set[str] | None = None,
) -> None:
    validate_attribute_value(
        definition,
        value,
        state=state,
        subject_types=[subject_type],
        attached_attribute_ids=(
            set(getattr(subject, "attributes", {}))
            if attached_attribute_ids is None
            else attached_attribute_ids
        ),
    )
    if subject_type != "item" or getattr(subject, "attribute_profile", None) != "weapon":
        if subject_type == "action":
            if definition.id in {
                ACTION_RANGE_ATTRIBUTE_ID,
                ACTION_MANA_COST_ATTRIBUTE_ID,
                ACTION_BASE_SPELL_DAMAGE_ATTRIBUTE_ID,
            } and (
                not isinstance(value.value, (int, float))
                or isinstance(value.value, bool)
                or value.value < 0
            ):
                raise ValueError(f"Action Attribute '{definition.id}' must be nonnegative.")
            if definition.id == ACTION_TARGET_COUNT_ATTRIBUTE_ID and (
                not isinstance(value.value, (int, float))
                or isinstance(value.value, bool)
                or value.value < 1
                or int(value.value) != value.value
            ):
                raise ValueError("Action Target Count must be a positive whole number.")
        return
    if definition.id == WEAPON_TYPE_ATTRIBUTE_ID:
        if not isinstance(value.value, str) or not value.value.strip():
            raise ValueError("Weapon Type is required.")
    if definition.id == WEAPON_DAMAGE_TYPES_ATTRIBUTE_ID:
        if not isinstance(value.value, list) or not value.value:
            raise ValueError("At least one physical weapon damage type is required.")
    if definition.id in {
        WEAPON_BASE_DAMAGE_ATTRIBUTE_ID,
        WEAPON_REACH_ATTRIBUTE_ID,
        WEAPON_PROFICIENCY_GROWTH_RATE_ATTRIBUTE_ID,
    }:
        if (
            not isinstance(value.value, (int, float))
            or isinstance(value.value, bool)
            or value.value < 0
        ):
            raise ValueError(f"Weapon Attribute '{definition.id}' must be nonnegative.")


def _attribute_references(state: State, attribute_id: str) -> list[tuple[str, str, object]]:
    references: list[tuple[str, str, object]] = []
    references.extend(
        ("sheets", sheet.id, sheet)
        for sheet in state.sheets.values()
        if attribute_id in sheet.attributes
    )
    references.extend(
        ("instanced_sheets", instance_id, instance)
        for instance_id, instance in state.instanced_sheets.items()
        if attribute_id in instance.attributes
    )
    references.extend(
        ("items", item.id, item)
        for item in state.items.values()
        if attribute_id in item.attributes
    )
    references.extend(
        ("actions", action.id, action)
        for action in state.actions.values()
        if attribute_id in action.attributes
    )
    return references


def _required_sheet_and_definition(
    state: State,
    sheet_id: str,
    attribute_id: str,
) -> tuple[Sheet, AttributeDefinition, AttributeBridge]:
    sheet = state.sheets.get(sheet_id)
    if sheet is None:
        raise ValueError(f"Sheet '{sheet_id}' does not exist.")
    definition = state.attributes.get(attribute_id)
    if definition is None or "sheet" not in definition.subject_types:
        raise ValueError(f"Sheet Attribute '{attribute_id}' does not exist.")
    if AMOUNT_OF_REACTIONS_ATTRIBUTE_ID not in sheet.attributes:
        synchronize_required_sheet_attributes(sheet)
    bridge = sheet.attributes.get(attribute_id)
    if bridge is None:
        raise ValueError(f"Attribute '{attribute_id}' is not attached to sheet '{sheet_id}'.")
    return sheet, definition, bridge


def _required_instance_and_definition(
    state: State,
    instance_id: str,
    attribute_id: str,
) -> tuple[object, AttributeDefinition, AttributeBridge]:
    instance = state.instanced_sheets.get(instance_id)
    if instance is None:
        raise ValueError(f"Instance '{instance_id}' does not exist.")
    definition = state.attributes.get(attribute_id)
    if definition is None or "sheet" not in definition.subject_types:
        raise ValueError(f"Sheet Attribute '{attribute_id}' does not exist.")
    if AMOUNT_OF_REACTIONS_ATTRIBUTE_ID not in instance.attributes:
        synchronize_required_sheet_attributes(instance)
    bridge = instance.attributes.get(attribute_id)
    if bridge is None:
        raise ValueError(f"Attribute '{attribute_id}' is not attached to instance '{instance_id}'.")
    return instance, definition, bridge


def _build_definition(
    payload: AttributeDefinitionPayload,
    *,
    state: State,
) -> AttributeDefinition:
    if not payload.subject_types:
        raise ValueError("A Attribute must allow at least one subject type.")
    if payload.value_type in {"enum", "list"}:
        if not payload.validation_options:
            raise ValueError(
                f"{payload.value_type.title()} Attributes require validation options."
            )
    if payload.value_type == "reference" and not payload.reference_kind:
        raise ValueError("Reference Attributes require a reference kind.")
    if (
        payload.value_type == "reference"
        and payload.reference_kind not in REFERENCE_COLLECTIONS
    ):
        raise ValueError(
            f"Unsupported Attribute reference kind '{payload.reference_kind}'."
        )
    value = _build_attribute_value(payload.default_value)
    if value.type == "formula" and any(
        alias.path == ["attributes", payload.id]
        for alias in value.formula.aliases or []
    ):
        raise ValueError(f"Attribute '{payload.id}' default formula cannot reference itself.")
    definition = AttributeDefinition(
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
    validate_attribute_value(
        definition,
        value,
        state=state,
        subject_types=list(definition.subject_types),
    )
    return definition


def _apply_candidate_sheet_attributes(
    state: State,
    sheet_id: str,
    candidate: Sheet,
) -> list[PatchOp]:
    sheet = state.sheets[sheet_id]
    operations: list[PatchOp] = []
    for attribute_id in sorted(set(sheet.attributes) | set(candidate.attributes)):
        path = state_sync_service.join_path("sheets", sheet_id, "attributes", attribute_id)
        current = sheet.attributes.get(attribute_id)
        updated = candidate.attributes.get(attribute_id)
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


def _apply_candidate_instance_attributes(
    state: State,
    instance_id: str,
    candidate: object,
) -> list[PatchOp]:
    instance = state.instanced_sheets[instance_id]
    operations: list[PatchOp] = []
    for attribute_id in sorted(set(instance.attributes) | set(candidate.attributes)):
        path = state_sync_service.join_path(
            "instanced_sheets", instance_id, "attributes", attribute_id
        )
        current = instance.attributes.get(attribute_id)
        updated = candidate.attributes.get(attribute_id)
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
    attribute_id: str,
) -> tuple[object, AttributeDefinition, AttributeBridge | None]:
    subject = _subject_collection(state, subject_type).get(subject_id)
    if subject is None:
        raise ValueError(f"{subject_type.title()} '{subject_id}' does not exist.")
    definition = state.attributes.get(attribute_id)
    if definition is None or subject_type not in definition.subject_types:
        raise ValueError(
            f"{subject_type.title()} Attribute '{attribute_id}' does not exist."
        )
    if (
        subject_type == "item"
        and definition.required_profile is not None
        and subject.attribute_profile != definition.required_profile
    ):
        raise ValueError(
            f"Attribute '{attribute_id}' requires item profile "
            f"'{definition.required_profile}'."
        )
    return subject, definition, subject.attributes.get(attribute_id)


def _apply_candidate_subject_attributes(
    state: State,
    subject_type: str,
    subject_id: str,
    candidate: object,
) -> list[PatchOp]:
    subject = _subject_collection(state, subject_type)[subject_id]
    operations: list[PatchOp] = []
    for attribute_id in sorted(set(subject.attributes) | set(candidate.attributes)):
        path = state_sync_service.join_path(
            f"{subject_type}s", subject_id, "attributes", attribute_id
        )
        current = subject.attributes.get(attribute_id)
        updated = candidate.attributes.get(attribute_id)
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


def reevaluate_sheet_attributes_mutations(
    state: State,
    sheet_id: str,
) -> list[PatchOp]:
    sheet = state.sheets.get(sheet_id)
    if sheet is None:
        raise ValueError(f"Sheet '{sheet_id}' does not exist.")
    candidate = deepcopy(sheet)
    synchronize_all_sheet_attributes(candidate)
    return _apply_candidate_sheet_attributes(state, sheet_id, candidate)


def reevaluate_instance_attributes_mutations(
    state: State,
    instance_id: str,
) -> list[PatchOp]:
    instance = state.instanced_sheets.get(instance_id)
    if instance is None:
        raise ValueError(f"Instance '{instance_id}' does not exist.")
    candidate = deepcopy(instance)
    synchronize_all_sheet_attributes(candidate)
    return _apply_candidate_instance_attributes(state, instance_id, candidate)


def validate_and_evaluate_sheet_attributes(
    sheet: Sheet,
    attribute_ids: set[str] | None = None,
) -> None:
    validate_sheet_formula_dependencies(sheet)
    synchronize_all_sheet_attributes(sheet)
    require_valid_subject_attribute_evaluation(sheet, attribute_ids)


def validate_and_evaluate_subject_attributes(subject: object) -> None:
    evaluate_all_subject_attributes(subject)
    require_valid_subject_attribute_evaluation(subject)


async def create_attribute(request: CreateAttribute) -> None:
    if (
        request.attribute.required
        or request.attribute.required_profile is not None
        or request.attribute.backend_owned
    ):
        raise ValueError("Required Attribute metadata is backend-owned.")

    def mutation(state: State) -> tuple[None, list]:
        if request.attribute.id in state.attributes:
            raise ValueError(f"Attribute '{request.attribute.id}' already exists.")
        definition = _build_definition(request.attribute, state=state)
        path = state_sync_service.join_path("attributes", definition.id)
        return None, [state_sync_service.add_mutation(state, path, definition)]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def update_attribute(request: UpdateAttribute) -> None:
    if request.attribute.id != request.attribute_id:
        raise ValueError("Attribute ID cannot be changed.")

    def mutation(state: State) -> tuple[None, list]:
        current = state.attributes.get(request.attribute_id)
        if current is None:
            raise ValueError(f"Attribute '{request.attribute_id}' does not exist.")
        if current.backend_owned:
            raise ValueError("Backend-owned Attribute definitions cannot be changed.")
        if (
            request.attribute.required
            or request.attribute.required_profile is not None
            or request.attribute.backend_owned
        ):
            raise ValueError("Required Attribute metadata is backend-owned.")
        definition = _build_definition(request.attribute, state=state)
        attribute_references = _attribute_references(state, request.attribute_id)
        for root, _, subject in attribute_references:
            subject_type = (
                "sheet"
                if root in {"sheets", "instanced_sheets"}
                else root.removesuffix("s")
            )
            validate_subject_attribute_value(
                state,
                subject_type,
                subject,
                definition,
                subject.attributes[request.attribute_id].value,
            )
        referencing_subjects = [
            sheet.id
            for sheet in state.sheets.values()
            if request.attribute_id in sheet.attributes
        ]
        referencing_subjects.extend(
            instance_id
            for instance_id, instance in state.instanced_sheets.items()
            if request.attribute_id in instance.attributes
        )
        if referencing_subjects and "sheet" not in definition.subject_types:
            raise ValueError(
                f"Attribute '{request.attribute_id}' is attached to sheets: "
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
                if request.attribute_id in subject.attributes
            )
            if subject_references and subject_type not in definition.subject_types:
                raise ValueError(
                    f"Attribute '{request.attribute_id}' is attached to {subject_type}s: "
                    + ", ".join(subject_references)
                    + "."
                )
        path = state_sync_service.join_path("attributes", request.attribute_id)
        operations = [state_sync_service.set_mutation(state, path, definition)]
        if current.visibility != definition.visibility:
            for root, subject_id, subject in attribute_references:
                bridge_path = state_sync_service.join_path(
                    root,
                    subject_id,
                    "attributes",
                    request.attribute_id,
                )
                operations.append(
                    state_sync_service.set_mutation(
                        state,
                        bridge_path,
                        subject.attributes[request.attribute_id],
                    )
                )
        return None, operations

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def delete_attribute(request: DeleteAttribute) -> None:
    def mutation(state: State) -> tuple[None, list]:
        definition = state.attributes.get(request.attribute_id)
        if definition is None:
            raise ValueError(f"Attribute '{request.attribute_id}' does not exist.")
        if definition.backend_owned:
            raise ValueError("Backend-owned Attribute definitions cannot be deleted.")
        referencing_sheets = sorted(
            sheet.id
            for sheet in state.sheets.values()
            if request.attribute_id in sheet.attributes
        )
        if referencing_sheets:
            raise ValueError(
                f"Attribute '{request.attribute_id}' is attached to sheets: "
                + ", ".join(referencing_sheets)
                + "."
            )
        referencing_instances = sorted(
            instance_id
            for instance_id, instance in state.instanced_sheets.items()
            if request.attribute_id in instance.attributes
        )
        if referencing_instances:
            raise ValueError(
                f"Attribute '{request.attribute_id}' is attached to instances: "
                + ", ".join(referencing_instances)
                + "."
            )
        for subject_type, collection in (
            ("items", state.items),
            ("actions", state.actions),
        ):
            references = sorted(
                subject.id
                for subject in collection.values()
                if request.attribute_id in subject.attributes
            )
            if references:
                raise ValueError(
                    f"Attribute '{request.attribute_id}' is attached to {subject_type}: "
                    + ", ".join(references)
                    + "."
                )
        path = state_sync_service.join_path("attributes", request.attribute_id)
        _, operation = state_sync_service.remove_mutation(state, path)
        return None, [operation]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def attach_sheet_attribute(request: AttachSheetAttribute) -> None:
    def mutation(state: State) -> tuple[None, list]:
        sheet = state.sheets.get(request.sheet_id)
        if sheet is None:
            raise ValueError(f"Sheet '{request.sheet_id}' does not exist.")
        definition = state.attributes.get(request.attribute_id)
        if definition is None or "sheet" not in definition.subject_types:
            raise ValueError(f"Sheet Attribute '{request.attribute_id}' does not exist.")
        if request.attribute_id in sheet.attributes:
            raise ValueError(
                f"Attribute '{request.attribute_id}' is already attached to sheet '{request.sheet_id}'."
            )
        if any(
            bridge.relationship_id == request.relationship_id
            for bridge in sheet.attributes.values()
        ):
            raise ValueError(
                f"Attribute relationship '{request.relationship_id}' already exists."
            )
        value = (
            _build_attribute_value(request.value)
            if request.value is not None
            else deepcopy(definition.default_value)
        )
        validate_subject_attribute_value(
            state,
            "sheet",
            sheet,
            definition,
            value,
            attached_attribute_ids={*sheet.attributes, request.attribute_id},
        )
        candidate = deepcopy(sheet)
        candidate.attributes[request.attribute_id] = AttributeBridge(
            relationship_id=request.relationship_id,
            attribute_id=request.attribute_id,
            value=value,
        )
        validate_and_evaluate_sheet_attributes(candidate)
        return None, _apply_candidate_sheet_attributes(state, request.sheet_id, candidate)

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def detach_sheet_attribute(request: DetachSheetAttribute) -> None:
    def mutation(state: State) -> tuple[None, list]:
        sheet, definition, _ = _required_sheet_and_definition(
            state, request.sheet_id, request.attribute_id
        )
        if definition.required:
            raise ValueError("Required Attributes cannot be detached.")
        candidate = deepcopy(sheet)
        candidate.attributes.pop(request.attribute_id)
        validate_and_evaluate_sheet_attributes(candidate)
        return None, _apply_candidate_sheet_attributes(state, request.sheet_id, candidate)

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def attach_instanced_sheet_attribute(request: AttachInstancedSheetAttribute) -> None:
    def mutation(state: State) -> tuple[None, list]:
        instance = state.instanced_sheets.get(request.instance_id)
        if instance is None:
            raise ValueError(f"Instance '{request.instance_id}' does not exist.")
        definition = state.attributes.get(request.attribute_id)
        if definition is None or "sheet" not in definition.subject_types:
            raise ValueError(f"Sheet Attribute '{request.attribute_id}' does not exist.")
        if request.attribute_id in instance.attributes:
            raise ValueError(
                f"Attribute '{request.attribute_id}' is already attached to instance "
                f"'{request.instance_id}'."
            )
        if any(
            bridge.relationship_id == request.relationship_id
            for bridge in instance.attributes.values()
        ):
            raise ValueError(
                f"Attribute relationship '{request.relationship_id}' already exists."
            )
        value = (
            _build_attribute_value(request.value)
            if request.value is not None
            else deepcopy(definition.default_value)
        )
        validate_subject_attribute_value(
            state,
            "sheet",
            instance,
            definition,
            value,
            attached_attribute_ids={*instance.attributes, request.attribute_id},
        )
        candidate = deepcopy(instance)
        candidate.attributes[request.attribute_id] = AttributeBridge(
            relationship_id=request.relationship_id,
            attribute_id=request.attribute_id,
            value=value,
        )
        validate_and_evaluate_sheet_attributes(candidate)
        return None, _apply_candidate_instance_attributes(
            state, request.instance_id, candidate
        )

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def detach_instanced_sheet_attribute(request: DetachInstancedSheetAttribute) -> None:
    def mutation(state: State) -> tuple[None, list]:
        instance, definition, _ = _required_instance_and_definition(
            state, request.instance_id, request.attribute_id
        )
        if definition.required:
            raise ValueError("Required Attributes cannot be detached.")
        candidate = deepcopy(instance)
        candidate.attributes.pop(request.attribute_id)
        validate_and_evaluate_sheet_attributes(candidate)
        return None, _apply_candidate_instance_attributes(
            state, request.instance_id, candidate
        )

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def attach_subject_attribute(request: AttachSubjectAttribute) -> None:
    def mutation(state: State) -> tuple[None, list]:
        subject, definition, bridge = _subject_and_definition(
            state,
            request.subject_type,
            request.subject_id,
            request.attribute_id,
        )
        if bridge is not None:
            raise ValueError(
                f"Attribute '{request.attribute_id}' is already attached to "
                f"{request.subject_type} '{request.subject_id}'."
            )
        if any(
            current.relationship_id == request.relationship_id
            for current in subject.attributes.values()
        ):
            raise ValueError(
                f"Attribute relationship '{request.relationship_id}' already exists."
            )
        value = (
            _build_attribute_value(request.value)
            if request.value is not None
            else deepcopy(definition.default_value)
        )
        validate_subject_attribute_value(
            state,
            request.subject_type,
            subject,
            definition,
            value,
            attached_attribute_ids={*subject.attributes, request.attribute_id},
        )
        candidate = deepcopy(subject)
        candidate.attributes[request.attribute_id] = AttributeBridge(
            relationship_id=request.relationship_id,
            attribute_id=request.attribute_id,
            value=value,
        )
        validate_and_evaluate_subject_attributes(candidate)
        return None, _apply_candidate_subject_attributes(
            state, request.subject_type, request.subject_id, candidate
        )

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def set_subject_attribute_value(request: SetSubjectAttributeValue) -> None:
    def mutation(state: State) -> tuple[None, list]:
        subject, definition, bridge = _subject_and_definition(
            state,
            request.subject_type,
            request.subject_id,
            request.attribute_id,
        )
        if bridge is None:
            raise ValueError(f"Attribute '{request.attribute_id}' is not attached.")
        value = _build_attribute_value(request.value)
        validate_subject_attribute_value(
            state,
            request.subject_type,
            subject,
            definition,
            value,
        )
        candidate = deepcopy(subject)
        candidate.attributes[request.attribute_id].value = value
        validate_and_evaluate_subject_attributes(candidate)
        return None, _apply_candidate_subject_attributes(
            state, request.subject_type, request.subject_id, candidate
        )

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def reset_subject_attribute_value(request: ResetSubjectAttributeValue) -> None:
    def mutation(state: State) -> tuple[None, list]:
        subject, definition, bridge = _subject_and_definition(
            state,
            request.subject_type,
            request.subject_id,
            request.attribute_id,
        )
        if bridge is None:
            raise ValueError(f"Attribute '{request.attribute_id}' is not attached.")
        validate_subject_attribute_value(
            state,
            request.subject_type,
            subject,
            definition,
            definition.default_value,
        )
        candidate = deepcopy(subject)
        candidate.attributes[request.attribute_id].value = deepcopy(definition.default_value)
        validate_and_evaluate_subject_attributes(candidate)
        return None, _apply_candidate_subject_attributes(
            state, request.subject_type, request.subject_id, candidate
        )

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def detach_subject_attribute(request: DetachSubjectAttribute) -> None:
    def mutation(state: State) -> tuple[None, list]:
        subject, definition, bridge = _subject_and_definition(
            state,
            request.subject_type,
            request.subject_id,
            request.attribute_id,
        )
        if bridge is None:
            raise ValueError(f"Attribute '{request.attribute_id}' is not attached.")
        if definition.required:
            raise ValueError("Required Attributes cannot be detached.")
        candidate = deepcopy(subject)
        candidate.attributes.pop(request.attribute_id)
        validate_and_evaluate_subject_attributes(candidate)
        return None, _apply_candidate_subject_attributes(
            state, request.subject_type, request.subject_id, candidate
        )

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def set_sheet_attribute_value(request: SetSheetAttributeValue) -> None:
    def mutation(state: State) -> tuple[None, list]:
        sheet, definition, _ = _required_sheet_and_definition(
            state,
            request.sheet_id,
            request.attribute_id,
        )
        value = _build_attribute_value(request.value)
        validate_subject_attribute_value(
            state,
            "sheet",
            sheet,
            definition,
            value,
        )
        candidate = deepcopy(sheet)
        candidate.attributes[request.attribute_id].value = deepcopy(value)
        validate_and_evaluate_sheet_attributes(candidate)
        return None, _apply_candidate_sheet_attributes(state, request.sheet_id, candidate)

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def reset_sheet_attribute_value(request: ResetSheetAttributeValue) -> None:
    def mutation(state: State) -> tuple[None, list]:
        sheet, definition, _ = _required_sheet_and_definition(
            state,
            request.sheet_id,
            request.attribute_id,
        )
        candidate = deepcopy(sheet)
        candidate.attributes[request.attribute_id].value = deepcopy(definition.default_value)
        validate_and_evaluate_sheet_attributes(candidate)
        return None, _apply_candidate_sheet_attributes(state, request.sheet_id, candidate)

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def set_instanced_sheet_attribute_value(
    request: SetInstancedSheetAttributeValue,
) -> None:
    def mutation(state: State) -> tuple[None, list]:
        instance, definition, _ = _required_instance_and_definition(
            state,
            request.instance_id,
            request.attribute_id,
        )
        value = _build_attribute_value(request.value)
        validate_subject_attribute_value(
            state,
            "sheet",
            instance,
            definition,
            value,
        )
        candidate = deepcopy(instance)
        candidate.attributes[request.attribute_id].value = deepcopy(value)
        validate_and_evaluate_sheet_attributes(candidate)
        return None, _apply_candidate_instance_attributes(
            state, request.instance_id, candidate
        )

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def reset_instanced_sheet_attribute_value(
    request: ResetInstancedSheetAttributeValue,
) -> None:
    def mutation(state: State) -> tuple[None, list]:
        instance, definition, _ = _required_instance_and_definition(
            state,
            request.instance_id,
            request.attribute_id,
        )
        candidate = deepcopy(instance)
        candidate.attributes[request.attribute_id].value = deepcopy(definition.default_value)
        validate_and_evaluate_sheet_attributes(candidate)
        return None, _apply_candidate_instance_attributes(
            state, request.instance_id, candidate
        )

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)
