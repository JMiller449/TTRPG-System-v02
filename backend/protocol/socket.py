from __future__ import annotations

from dataclasses import asdict, is_dataclass
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter

from backend.features.auth.schema import Authenticate, AuthRole
from backend.features.chat.schema import GetRoll20BridgeStatus, SendRoll20ChatMessage
from backend.features.encounters.schema import (
    DeleteEncounterPreset,
    SaveEncounterPreset,
    SpawnEncounterPreset,
)
from backend.features.sheet_admin.actions.schema import (
    CreateAction,
    DeleteAction,
    UpdateAction,
)
from backend.features.sheet_admin.conditions.schema import (
    CreateConditionPreset,
    DeleteConditionPreset,
    UpdateConditionPreset,
)
from backend.features.sheet_admin.formulas.schema import (
    CreateFormula,
    DeleteFormula,
    UpdateFormula,
)
from backend.features.sheet_admin.items.schema import (
    CreateItem,
    DeleteItem,
    RemoveItemAugmentationTemplate,
    UpdateItem,
    UpsertItemAugmentationTemplate,
)
from backend.features.sheet_admin.proficiencies.schema import (
    CreateProficiency,
    DeleteProficiency,
    UpdateProficiency,
)
from backend.features.sheet_admin.sheets.schema import (
    AdjustInstancedSheetResource,
    CreateInstancedSheet,
    CreateSheetActionBridge,
    CreateSheetItemBridge,
    CreateSheetProficiencyBridge,
    CreateSheet,
    DeleteSheetActionBridge,
    DeleteSheetItemBridge,
    DeleteSheetProficiencyBridge,
    DeleteSheet,
    SetInstancedSheetNotes,
    SetInstancedSheetResource,
    SetSheetNotes,
    UpdateSheetActionBridge,
    UpdateSheetItemBridge,
    UpdateSheetProficiencyBridge,
    UpdateSheet,
)
from backend.features.sheet_admin.stats.schema import (
    SetSheetBaseStat,
    SetSheetFormulaStat,
)
from backend.features.sheet_access.schema import (
    ClaimSheetAccessCode,
    GenerateSheetAccessCode,
    GetSheetAccessCodes,
)
from backend.features.sheet_runtime.schema import PerformAction
from backend.features.state_sync.schema import ResyncState
from backend.features.variable_registry.schema import (
    GetActionFormulaAuthoringMetadata,
    GetAugmentationTargetMetadata,
    GetVariableRegistry,
)
from backend.protocol.state_schema import ActionStepPayload, BackendStateSnapshotPayload


class ProtocolModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PatchOperation(ProtocolModel):
    op: Literal["set", "inc", "add", "remove"]
    path: str
    value: Any | None = None


class ErrorEvent(ProtocolModel):
    response_id: str | None = None
    reason: str
    type: Literal["error"] = "error"
    request_id: str | None = None


class AuthenticateResponseEvent(ProtocolModel):
    response_id: str | None = None
    authenticated: bool
    role: AuthRole | None
    reason: str | None = None
    type: Literal["authenticate_response"] = "authenticate_response"
    request_id: str | None = None


class StateSnapshotEvent(ProtocolModel):
    response_id: str | None = None
    state: BackendStateSnapshotPayload
    state_version: int
    type: Literal["state_snapshot"] = "state_snapshot"
    request_id: str | None = None


class StatePatchEvent(ProtocolModel):
    response_id: str | None = None
    ops: list[PatchOperation] | None = None
    state_version: int = 0
    type: Literal["state_patch"] = "state_patch"
    request_id: str | None = None


class ActionExecutedEvent(ProtocolModel):
    response_id: str | None = None
    sheet_id: str = Field(min_length=1)
    action_id: str = Field(min_length=1)
    applied_mutations: list[str]
    emitted_messages: list[str]
    type: Literal["action_executed"] = "action_executed"
    request_id: str | None = None


class Roll20BridgeStatusEvent(ProtocolModel):
    response_id: str | None = None
    connected: bool
    type: Literal["roll20_bridge_status"] = "roll20_bridge_status"
    request_id: str | None = None


class VariablePathMetadataEvent(ProtocolModel):
    key: str
    label: str
    root: Literal["state", "sheet", "instance"]
    path: list[str]
    value_type: Literal["number", "percent", "formula", "resource"]
    editable_roles: list[Literal["unauthenticated", "player", "dm"]]
    formula_backed: bool = False
    description: str = ""
    shortcuts: list[str] | None = None


class VariableRegistryEvent(ProtocolModel):
    response_id: str | None = None
    variables: list[VariablePathMetadataEvent]
    type: Literal["variable_registry"] = "variable_registry"
    request_id: str | None = None


class AuthoringVariablePathMetadataEvent(ProtocolModel):
    key: str
    label: str
    root: Literal["state", "sheet", "instance"]
    path: list[str]
    value_type: Literal["number", "percent", "formula", "resource"]
    editable_roles: list[Literal["unauthenticated", "player", "dm"]]
    formula_backed: bool = False
    description: str = ""
    shortcuts: list[str] | None = None
    formula_reference_allowed: bool = True
    action_mutation_allowed: bool = False


class FormulaAliasMetadataEvent(ProtocolModel):
    name: str
    key: str
    root: Literal["state", "sheet", "instance"]
    path: list[str]


class ActionStepAuthoringMetadataEvent(ProtocolModel):
    type: str
    label: str
    category: Literal["roll20_output", "bounded_mutation", "semantic_mutation"]
    allowed_targets: list[Literal["caster", "target"]]
    formula_fields: list[str]
    path_catalog: Literal[
        "none",
        "variable_mutation_paths",
        "proficiency_bridges",
        "augmentation_records",
        "condition_presets",
    ]


class ActionPresetTemplateEvent(ProtocolModel):
    id: str
    label: str
    category: Literal["healing", "resource"]
    description: str
    steps: list[ActionStepPayload]
    editable_formula_fields: list[str]


class ActionFormulaAuthoringMetadataEvent(ProtocolModel):
    response_id: str | None = None
    variables: list[AuthoringVariablePathMetadataEvent]
    formula_roots: list[Literal["state", "sheet", "instance"]]
    action_mutation_roots: list[Literal["state", "sheet", "instance"]]
    formula_aliases: list[FormulaAliasMetadataEvent]
    action_steps: list[ActionStepAuthoringMetadataEvent]
    action_preset_templates: list[ActionPresetTemplateEvent]
    type: Literal[
        "action_formula_authoring_metadata"
    ] = "action_formula_authoring_metadata"
    request_id: str | None = None


class AugmentationTargetMetadataPayload(ProtocolModel):
    key: str
    label: str
    root: Literal["state", "sheet", "instance"]
    path: list[str]
    value_type: Literal["number", "percent", "formula", "resource"]
    description: str
    allowed_contexts: list[Literal["item_template", "condition_template", "runtime"]]


class AugmentationTargetMetadataEvent(ProtocolModel):
    response_id: str | None = None
    targets: list[AugmentationTargetMetadataPayload]
    context: Literal["item_template", "condition_template", "runtime"] | None = None
    type: Literal["augmentation_target_metadata"] = "augmentation_target_metadata"
    request_id: str | None = None


class SheetAccessCodeEventPayload(ProtocolModel):
    code: str
    sheet_id: str
    instance_id: str | None = None
    active: bool = True


class SheetAccessCodesEvent(ProtocolModel):
    response_id: str | None = None
    codes: list[SheetAccessCodeEventPayload]
    type: Literal["sheet_access_codes"] = "sheet_access_codes"
    request_id: str | None = None


class SheetAccessClaimedEvent(ProtocolModel):
    response_id: str | None = None
    sheet_id: str = Field(min_length=1)
    instance_id: str = Field(min_length=1)
    type: Literal["sheet_access_claimed"] = "sheet_access_claimed"
    request_id: str | None = None


ApplicationRequest = Annotated[
    Authenticate
    | ResyncState
    | SendRoll20ChatMessage
    | GetRoll20BridgeStatus
    | SaveEncounterPreset
    | DeleteEncounterPreset
    | SpawnEncounterPreset
    | GenerateSheetAccessCode
    | GetSheetAccessCodes
    | ClaimSheetAccessCode
    | CreateAction
    | UpdateAction
    | DeleteAction
    | CreateConditionPreset
    | UpdateConditionPreset
    | DeleteConditionPreset
    | CreateFormula
    | UpdateFormula
    | DeleteFormula
    | CreateItem
    | UpdateItem
    | DeleteItem
    | CreateProficiency
    | UpdateProficiency
    | DeleteProficiency
    | CreateSheet
    | UpdateSheet
    | DeleteSheet
    | SetSheetNotes
    | SetInstancedSheetNotes
    | SetInstancedSheetResource
    | AdjustInstancedSheetResource
    | CreateInstancedSheet
    | CreateSheetActionBridge
    | UpdateSheetActionBridge
    | DeleteSheetActionBridge
    | CreateSheetItemBridge
    | UpdateSheetItemBridge
    | DeleteSheetItemBridge
    | CreateSheetProficiencyBridge
    | UpdateSheetProficiencyBridge
    | DeleteSheetProficiencyBridge
    | UpsertItemAugmentationTemplate
    | RemoveItemAugmentationTemplate
    | SetSheetBaseStat
    | SetSheetFormulaStat
    | GetActionFormulaAuthoringMetadata
    | GetAugmentationTargetMetadata
    | GetVariableRegistry
    | PerformAction,
    Field(discriminator="type"),
]

ServerEvent = Annotated[
    ErrorEvent
    | AuthenticateResponseEvent
    | StateSnapshotEvent
    | StatePatchEvent
    | ActionExecutedEvent
    | Roll20BridgeStatusEvent
    | ActionFormulaAuthoringMetadataEvent
    | AugmentationTargetMetadataEvent
    | VariableRegistryEvent
    | SheetAccessCodesEvent
    | SheetAccessClaimedEvent,
    Field(discriminator="type"),
]

_APPLICATION_REQUEST_ADAPTER = TypeAdapter(ApplicationRequest)
_SERVER_EVENT_ADAPTER = TypeAdapter(ServerEvent)


def parse_application_request(payload: Any) -> BaseModel:
    return _APPLICATION_REQUEST_ADAPTER.validate_python(payload)


def normalize_server_event(payload: Any) -> dict[str, Any]:
    if isinstance(payload, BaseModel):
        raw_payload = payload.model_dump(mode="json")
    elif is_dataclass(payload):
        raw_payload = asdict(payload)
    elif isinstance(payload, dict):
        raw_payload = dict(payload)
    else:
        raise TypeError(
            f"Unsupported websocket payload type: {payload.__class__.__name__}"
        )

    event = _SERVER_EVENT_ADAPTER.validate_python(raw_payload)
    return event.model_dump(mode="json")
