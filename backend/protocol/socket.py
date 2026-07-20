from __future__ import annotations

from dataclasses import asdict, is_dataclass
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter

from backend.features.auth.schema import Authenticate, AuthRole
from backend.features.chat.schema import (
    GetRoll20BridgeStatus,
    GetRoll20BridgeSyncConfig,
    SendRoll20ChatMessage,
)
from backend.features.encounters.schema import (
    DeleteEncounterPreset,
    SaveEncounterPreset,
    SpawnEncounterPreset,
)
from backend.features.attributes.schema import (
    AttachSheetAttribute,
    AttachSubjectAttribute,
    CreateAttribute,
    DeleteAttribute,
    DetachSheetAttribute,
    DetachSubjectAttribute,
    ResetSubjectAttributeValue,
    ResetSheetAttributeValue,
    SetSheetAttributeValue,
    SetSubjectAttributeValue,
    UpdateAttribute,
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
    AddPlayerInventoryItem,
    CreateItem,
    DeleteItem,
    RemovePlayerInventoryItem,
    RemoveItemAugmentationTemplate,
    ReviewPlayerItem,
    SubmitPlayerItem,
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
    DeleteInstancedSheet,
    DeleteSheetActionBridge,
    DeleteSheetItemBridge,
    DeleteSheetProficiencyBridge,
    DeleteSheet,
    SetInstancedSheetNotes,
    SetInstancedSheetProfile,
    SetInstancedSheetResource,
    SetSheetNotes,
    UpdateSheetActionBridge,
    UpdateSheetItemBridge,
    UpdateSheetProficiencyBridge,
    UpdateSheet,
)
from backend.features.sheet_admin.stats.schema import (
    AllocateInstancedSheetStatPoints,
    SetInstancedSheetBaseStat,
    SetInstancedSheetFormulaStat,
    SetInstancedSheetResistances,
    SetInstancedSheetUnassignedStatPoints,
    SetSheetBaseStat,
    SetSheetFormulaStat,
    SetSheetResistances,
)
from backend.features.sheet_access.schema import (
    ClaimSheetAccessCode,
    GenerateSheetAccessCode,
    GetSheetAccessCodes,
)
from backend.features.sheet_runtime.schema import PerformAction
from backend.features.sheet_runtime.schema import (
    AdjustInstancedSheetReactions,
    ResetInstancedSheetReactions,
)
from backend.features.contribution_points.schema import (
    AdjustContributionPoints,
    SetContributionPoints,
)
from backend.features.pinned_actions.schema import SetPinnedInstanceActions
from backend.features.state_backup.schema import ExportStateBackup, ImportStateBackup
from backend.features.state_sync.schema import ResyncState, UndoLastStateChange
from backend.features.variable_registry.schema import (
    GetActionFormulaAuthoringMetadata,
    GetAugmentationTargetMetadata,
    GetVariableRegistry,
)
from backend.features.xp_tracker.schema import (
    DeleteKill,
    DeleteParty,
    DeleteXpAdjustment,
    GetXpTracker,
    RecordKill,
    RecordPlayerKill,
    SaveParty,
    SaveXpAdjustment,
    SetMobKillVisibility,
    SetMobXpValue,
    SetSheetXpRequired,
    UpdateKill,
)
from backend.protocol.state_schema import (
    ActionStepPayload,
    BackendStateSnapshotPayload,
    AttributeValuePayload,
    FormulaPayload,
)


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
    binding_key: str | None = None
    binding_label: str | None = None
    type: Literal["roll20_bridge_status"] = "roll20_bridge_status"
    request_id: str | None = None


class Roll20BridgeSyncConfigEvent(ProtocolModel):
    response_id: str | None = None
    bridge_auth_token: str = Field(min_length=1)
    binding_key: str = Field(min_length=1)
    binding_label: str = Field(min_length=1)
    type: Literal["roll20_bridge_sync_config"] = "roll20_bridge_sync_config"
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
    root: Literal[
        "state", "sheet", "template", "instance", "action", "source_item"
    ]
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
    root: Literal[
        "state", "sheet", "template", "instance", "action", "source_item"
    ]
    path: list[str]


class AttributeFormulaVariablePathMetadataEvent(ProtocolModel):
    key: str
    label: str
    subject_types: list[Literal["sheet", "item", "action"]]
    path: list[str]
    value_type: Literal["number", "percent", "formula"]
    description: str = ""
    shortcuts: list[str] | None = None


class SheetFormulaStatDefaultMetadataEvent(ProtocolModel):
    stat_name: Literal[
        "lifting",
        "carry_weight",
        "acrobatics",
        "stamina",
        "reaction_time",
        "health",
        "endurance",
        "pain_tolerance",
        "sight_distance",
        "intuition",
        "registration",
        "mana",
        "control",
        "sensitivity",
        "charisma",
        "mental_fortitude",
        "courage",
    ]
    formula: FormulaPayload


class SheetResourceFormulaDefaultsMetadataEvent(ProtocolModel):
    max_health: FormulaPayload
    max_mana: FormulaPayload


class ActionStepAuthoringMetadataEvent(ProtocolModel):
    type: str
    label: str
    category: Literal[
        "calculation",
        "roll20_output",
        "bounded_mutation",
        "semantic_mutation",
    ]
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
    category: Literal[
        "healing",
        "resource",
        "weapon",
        "defense",
        "contest",
        "spell",
    ]
    description: str
    steps: list[ActionStepPayload]
    editable_formula_fields: list[str]
    roll_mode_kind: Literal["none", "check", "damage"] = "none"
    attribute_values: dict[str, AttributeValuePayload] = Field(default_factory=dict)


class ActionAttributePresetEvent(ProtocolModel):
    id: str
    label: str
    description: str
    attribute_values: dict[str, AttributeValuePayload]


class DefaultSheetActionMetadataEvent(ProtocolModel):
    action_id: str
    name: str
    description: str


class ActionFormulaAuthoringMetadataEvent(ProtocolModel):
    response_id: str | None = None
    variables: list[AuthoringVariablePathMetadataEvent]
    formula_roots: list[
        Literal[
            "state", "sheet", "template", "instance", "action", "source_item"
        ]
    ]
    action_mutation_roots: list[
        Literal[
            "state", "sheet", "template", "instance", "action", "source_item"
        ]
    ]
    formula_aliases: list[FormulaAliasMetadataEvent]
    action_steps: list[ActionStepAuthoringMetadataEvent]
    action_preset_templates: list[ActionPresetTemplateEvent]
    action_attribute_presets: list[ActionAttributePresetEvent]
    default_sheet_actions: list[DefaultSheetActionMetadataEvent] = Field(
        default_factory=list
    )
    attribute_formula_variables: list[AttributeFormulaVariablePathMetadataEvent] = Field(
        default_factory=list
    )
    sheet_formula_stat_defaults: list[
        SheetFormulaStatDefaultMetadataEvent
    ] = Field(default_factory=list)
    sheet_resource_formula_defaults: SheetResourceFormulaDefaultsMetadataEvent | None = None
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


class XpTrackerPartyMemberEvent(ProtocolModel):
    instance_id: str
    name: str


class XpTrackerPartyEvent(ProtocolModel):
    id: str
    name: str
    members: list[XpTrackerPartyMemberEvent]


class XpTrackerKillParticipantEvent(ProtocolModel):
    instance_id: str
    name: str


class XpTrackerKillEvent(ProtocolModel):
    id: str
    monster_name: str
    base_xp: float
    participants: list[XpTrackerKillParticipantEvent]
    participant_count: int
    xp_percentage: float
    xp_per_participant: float
    occurred_at: str
    monster_sheet_id: str | None = None
    notes: str = ""
    submitted_by_role: Literal["player", "dm"] = "dm"
    submitted_by_instance_id: str | None = None
    submitted_by_name: str | None = None


class XpTrackerAdjustmentEvent(ProtocolModel):
    id: str
    instance_id: str
    instance_name: str
    amount: float
    reason: str
    occurred_at: str


class XpTrackerSheetEvent(ProtocolModel):
    instance_id: str
    sheet_id: str
    name: str
    kills: list[XpTrackerKillEvent]
    adjustments: list[XpTrackerAdjustmentEvent]
    current_xp: float
    xp_required: float
    ready_to_level: bool


class XpTrackerMobEvent(ProtocolModel):
    sheet_id: str
    name: str
    xp_value: float
    visible_to_players: bool


class XpTrackerRecordableMobEvent(ProtocolModel):
    sheet_id: str
    name: str


class XpTrackerEvent(ProtocolModel):
    response_id: str | None = None
    can_manage: bool
    sheets: list[XpTrackerSheetEvent]
    parties: list[XpTrackerPartyEvent]
    kills: list[XpTrackerKillEvent]
    adjustments: list[XpTrackerAdjustmentEvent]
    mobs: list[XpTrackerMobEvent]
    recordable_mobs: list[XpTrackerRecordableMobEvent]
    type: Literal["xp_tracker"] = "xp_tracker"
    request_id: str | None = None


class StateBackupExportedEvent(ProtocolModel):
    response_id: str | None = None
    persisted_state_json: str
    schema_version: int
    type: Literal["state_backup_exported"] = "state_backup_exported"
    request_id: str | None = None


ApplicationRequest = Annotated[
    Authenticate
    | ResyncState
    | UndoLastStateChange
    | ExportStateBackup
    | ImportStateBackup
    | SendRoll20ChatMessage
    | GetRoll20BridgeStatus
    | GetRoll20BridgeSyncConfig
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
    | CreateAttribute
    | UpdateAttribute
    | DeleteAttribute
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
    | SetInstancedSheetProfile
    | SetInstancedSheetResource
    | AdjustInstancedSheetResource
    | CreateInstancedSheet
    | DeleteInstancedSheet
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
    | AddPlayerInventoryItem
    | RemovePlayerInventoryItem
    | SubmitPlayerItem
    | ReviewPlayerItem
    | AllocateInstancedSheetStatPoints
    | SetSheetBaseStat
    | SetInstancedSheetBaseStat
    | SetInstancedSheetUnassignedStatPoints
    | SetSheetFormulaStat
    | SetInstancedSheetFormulaStat
    | SetSheetResistances
    | SetInstancedSheetResistances
    | AttachSheetAttribute
    | DetachSheetAttribute
    | AttachSubjectAttribute
    | SetSubjectAttributeValue
    | ResetSubjectAttributeValue
    | DetachSubjectAttribute
    | SetSheetAttributeValue
    | ResetSheetAttributeValue
    | GetActionFormulaAuthoringMetadata
    | GetAugmentationTargetMetadata
    | GetVariableRegistry
    | PerformAction
    | GetXpTracker
    | SetSheetXpRequired
    | SetMobXpValue
    | SetMobKillVisibility
    | SaveParty
    | DeleteParty
    | RecordKill
    | RecordPlayerKill
    | UpdateKill
    | DeleteKill
    | SaveXpAdjustment
    | DeleteXpAdjustment
    | AdjustInstancedSheetReactions
    | ResetInstancedSheetReactions
    | SetContributionPoints
    | AdjustContributionPoints
    | SetPinnedInstanceActions,
    Field(discriminator="type"),
]

ServerEvent = Annotated[
    ErrorEvent
    | AuthenticateResponseEvent
    | StateSnapshotEvent
    | StatePatchEvent
    | ActionExecutedEvent
    | Roll20BridgeStatusEvent
    | Roll20BridgeSyncConfigEvent
    | ActionFormulaAuthoringMetadataEvent
    | AugmentationTargetMetadataEvent
    | VariableRegistryEvent
    | SheetAccessCodesEvent
    | SheetAccessClaimedEvent
    | XpTrackerEvent
    | StateBackupExportedEvent,
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
