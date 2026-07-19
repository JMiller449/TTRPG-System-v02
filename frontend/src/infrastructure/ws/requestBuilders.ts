import type { ProtocolApplicationRequest } from "@/infrastructure/ws/protocol";

type ProtocolRequest<TType extends ProtocolApplicationRequest["type"]> = Extract<
  ProtocolApplicationRequest,
  { type: TType }
>;

type OptionalRequestId = {
  requestId?: string | null;
};

function requestIdField(requestId: string | null | undefined): { request_id?: string | null } {
  return requestId === undefined ? {} : { request_id: requestId };
}

export type SheetResourceName = ProtocolRequest<"adjust_instanced_sheet_resource">["resource"];
export type InstancedSheetDamageType =
  ProtocolRequest<"apply_instanced_sheet_damage">["damage_type"];
export type SheetCoreStatName = ProtocolRequest<"set_sheet_base_stat">["stat_name"];
export type SheetStatPointAllocations =
  ProtocolRequest<"allocate_instanced_sheet_stat_points">["allocations"];
export type SheetFormulaStatName = ProtocolRequest<"set_sheet_formula_stat">["stat_name"];
export type SheetResistancesPayload = ProtocolRequest<"set_sheet_resistances">["resistances"];
export type InstancedSheetResistancesUpdatePayload =
  ProtocolRequest<"set_instanced_sheet_resistances">["resistances"];
export type SheetItemBridgePayload = ProtocolRequest<"create_sheet_item_bridge">["bridge"];
export type SheetActionBridgePayload = ProtocolRequest<"create_sheet_action_bridge">["bridge"];
export type InstancedSheetActionBridgePayload =
  ProtocolRequest<"create_instanced_sheet_action_bridge">["bridge"];
export type SheetProficiencyBridgePayload =
  ProtocolRequest<"create_sheet_proficiency_bridge">["bridge"];
export type InstancedSheetProficiencyBridgePayload =
  ProtocolRequest<"create_instanced_sheet_proficiency_bridge">["bridge"];
export type SheetDefinitionPayload = ProtocolRequest<"create_sheet">["sheet"];
export type InstancedSheetResistancesPayload =
  ProtocolRequest<"create_instanced_sheet">["resistances"];
export type ItemDefinitionPayload = ProtocolRequest<"create_item">["item"];
export type PlayerItemSubmissionPayload = ProtocolRequest<"submit_player_item">["item"];
export type AugmentationPayload =
  ProtocolRequest<"upsert_item_augmentation_template">["augmentation"];
export type FormulaPayload = ProtocolRequest<"set_sheet_formula_stat">["formula"];
export type AttributeValuePayload = ProtocolRequest<"set_sheet_attribute_value">["value"];
export type AttributeDefinitionPayload = ProtocolRequest<"create_attribute">["attribute"];
export type FormulaDefinitionPayload = ProtocolRequest<"create_formula">["formula"];
export type ActionDefinitionPayload = ProtocolRequest<"create_action">["action"];
export type ProficiencyDefinitionPayload = ProtocolRequest<"create_proficiency">["proficiency"];
export type ConditionPresetPayload = ProtocolRequest<"create_condition_preset">["condition"];
export type StandaloneEffectDefinitionPayload =
  ProtocolRequest<"create_standalone_effect">["effect"];
export type EncounterPresetPayload = ProtocolRequest<"save_encounter_preset">["encounter"];
export type ActionRollMode = NonNullable<ProtocolRequest<"perform_action">["roll_mode"]>;
export type ActionExecutionVisibility = NonNullable<
  ProtocolRequest<"perform_action">["visibility"]
>;
export type AugmentationTargetContext = NonNullable<
  ProtocolRequest<"get_augmentation_target_metadata">["context"]
>;

export function buildAuthenticateRequest({
  token,
  requestId
}: {
  token: string;
} & OptionalRequestId): ProtocolRequest<"authenticate"> {
  return {
    ...requestIdField(requestId),
    type: "authenticate",
    token
  };
}

export function buildGetRoll20BridgeStatusRequest({
  requestId
}: OptionalRequestId = {}): ProtocolRequest<"get_roll20_bridge_status"> {
  return {
    ...requestIdField(requestId),
    type: "get_roll20_bridge_status"
  };
}

export function buildGetRoll20BridgeSyncConfigRequest({
  requestId
}: OptionalRequestId = {}): ProtocolRequest<"get_roll20_bridge_sync_config"> {
  return {
    ...requestIdField(requestId),
    type: "get_roll20_bridge_sync_config"
  };
}

export function buildGetXpTrackerRequest({
  requestId
}: OptionalRequestId = {}): ProtocolRequest<"get_xp_tracker"> {
  return {
    ...requestIdField(requestId),
    type: "get_xp_tracker"
  };
}

export function buildSetSheetXpRequiredRequest({
  sheetId,
  xpRequired,
  requestId
}: {
  sheetId: string;
  xpRequired: number;
} & OptionalRequestId): ProtocolRequest<"set_sheet_xp_required"> {
  return {
    ...requestIdField(requestId),
    type: "set_sheet_xp_required",
    sheet_id: sheetId,
    xp_required: xpRequired
  };
}

export function buildSetMobXpValueRequest({
  mobSheetId,
  xpValue,
  requestId
}: {
  mobSheetId: string;
  xpValue: number;
} & OptionalRequestId): ProtocolRequest<"set_mob_xp_value"> {
  return {
    ...requestIdField(requestId),
    type: "set_mob_xp_value",
    mob_sheet_id: mobSheetId,
    xp_value: xpValue
  };
}

export function buildSetMobKillVisibilityRequest({
  mobSheetId,
  visible,
  requestId
}: {
  mobSheetId: string;
  visible: boolean;
} & OptionalRequestId): ProtocolRequest<"set_mob_kill_visibility"> {
  return {
    ...requestIdField(requestId),
    type: "set_mob_kill_visibility",
    mob_sheet_id: mobSheetId,
    visible
  };
}

export function buildSavePartyRequest({
  partyId,
  name,
  memberInstanceIds,
  requestId
}: {
  partyId: string;
  name: string;
  memberInstanceIds: string[];
} & OptionalRequestId): ProtocolRequest<"save_party"> {
  return {
    ...requestIdField(requestId),
    type: "save_party",
    party_id: partyId,
    name,
    member_instance_ids: memberInstanceIds
  };
}

export function buildDeletePartyRequest({
  partyId,
  requestId
}: { partyId: string } & OptionalRequestId): ProtocolRequest<"delete_party"> {
  return { ...requestIdField(requestId), type: "delete_party", party_id: partyId };
}

export function buildRecordKillRequest({
  killId,
  creditedInstanceId,
  monsterSheetId,
  monsterName,
  baseXp,
  occurredAt,
  notes,
  requestId
}: {
  killId: string;
  creditedInstanceId: string;
  monsterSheetId?: string | null;
  monsterName?: string | null;
  baseXp?: number | null;
  occurredAt?: string | null;
  notes?: string;
} & OptionalRequestId): ProtocolRequest<"record_kill"> {
  return {
    ...requestIdField(requestId),
    type: "record_kill",
    kill_id: killId,
    credited_instance_id: creditedInstanceId,
    monster_sheet_id: monsterSheetId ?? null,
    monster_name: monsterName ?? null,
    base_xp: baseXp ?? null,
    occurred_at: occurredAt ?? null,
    notes: notes ?? ""
  };
}

export function buildRecordPlayerKillRequest({
  killId,
  monsterSheetId,
  requestId
}: {
  killId: string;
  monsterSheetId: string;
} & OptionalRequestId): ProtocolRequest<"record_player_kill"> {
  return {
    ...requestIdField(requestId),
    type: "record_player_kill",
    kill_id: killId,
    monster_sheet_id: monsterSheetId
  };
}

export function buildUpdateKillRequest({
  killId,
  monsterSheetId,
  monsterName,
  baseXp,
  participantInstanceIds,
  occurredAt,
  notes,
  requestId
}: {
  killId: string;
  monsterSheetId?: string | null;
  monsterName: string;
  baseXp: number;
  participantInstanceIds: string[];
  occurredAt: string;
  notes?: string;
} & OptionalRequestId): ProtocolRequest<"update_kill"> {
  return {
    ...requestIdField(requestId),
    type: "update_kill",
    kill_id: killId,
    monster_sheet_id: monsterSheetId ?? null,
    monster_name: monsterName,
    base_xp: baseXp,
    participant_instance_ids: participantInstanceIds,
    occurred_at: occurredAt,
    notes: notes ?? ""
  };
}

export function buildDeleteKillRequest({
  killId,
  requestId
}: { killId: string } & OptionalRequestId): ProtocolRequest<"delete_kill"> {
  return { ...requestIdField(requestId), type: "delete_kill", kill_id: killId };
}

export function buildSaveXpAdjustmentRequest({
  adjustmentId,
  instanceId,
  amount,
  reason,
  occurredAt,
  requestId
}: {
  adjustmentId: string;
  instanceId: string;
  amount: number;
  reason?: string;
  occurredAt?: string | null;
} & OptionalRequestId): ProtocolRequest<"save_xp_adjustment"> {
  return {
    ...requestIdField(requestId),
    type: "save_xp_adjustment",
    adjustment_id: adjustmentId,
    instance_id: instanceId,
    amount,
    reason: reason ?? "",
    occurred_at: occurredAt ?? null
  };
}

export function buildDeleteXpAdjustmentRequest({
  adjustmentId,
  requestId
}: { adjustmentId: string } & OptionalRequestId): ProtocolRequest<"delete_xp_adjustment"> {
  return {
    ...requestIdField(requestId),
    type: "delete_xp_adjustment",
    adjustment_id: adjustmentId
  };
}

export function buildSendRoll20ChatMessageRequest({
  message,
  requestId
}: {
  message: string;
} & OptionalRequestId): ProtocolRequest<"send_roll20_chat_message"> {
  return {
    ...requestIdField(requestId),
    type: "send_roll20_chat_message",
    message
  };
}

export function buildClaimSheetAccessCodeRequest({
  code,
  requestId
}: {
  code: string;
} & OptionalRequestId): ProtocolRequest<"claim_sheet_access_code"> {
  return {
    ...requestIdField(requestId),
    type: "claim_sheet_access_code",
    code
  };
}

export function buildGenerateSheetAccessCodeRequest({
  sheetId,
  instanceId,
  requestId
}: {
  sheetId: string;
  instanceId?: string | null;
} & OptionalRequestId): ProtocolRequest<"generate_sheet_access_code"> {
  return {
    ...requestIdField(requestId),
    type: "generate_sheet_access_code",
    sheet_id: sheetId,
    ...(instanceId === undefined ? {} : { instance_id: instanceId })
  };
}

export function buildGetSheetAccessCodesRequest({
  requestId
}: OptionalRequestId = {}): ProtocolRequest<"get_sheet_access_codes"> {
  return {
    ...requestIdField(requestId),
    type: "get_sheet_access_codes"
  };
}

export function buildGetVariableRegistryRequest({
  requestId
}: OptionalRequestId = {}): ProtocolRequest<"get_variable_registry"> {
  return {
    ...requestIdField(requestId),
    type: "get_variable_registry"
  };
}

export function buildExportStateBackupRequest({
  requestId
}: OptionalRequestId = {}): ProtocolRequest<"export_state_backup"> {
  return {
    ...requestIdField(requestId),
    type: "export_state_backup"
  };
}

export function buildImportStateBackupRequest({
  persistedStateJson,
  requestId
}: {
  persistedStateJson: string;
} & OptionalRequestId): ProtocolRequest<"import_state_backup"> {
  return {
    ...requestIdField(requestId),
    type: "import_state_backup",
    persisted_state_json: persistedStateJson
  };
}

export function buildSaveEncounterPresetRequest({
  encounter,
  requestId
}: {
  encounter: EncounterPresetPayload;
} & OptionalRequestId): ProtocolRequest<"save_encounter_preset"> {
  return {
    ...requestIdField(requestId),
    type: "save_encounter_preset",
    encounter
  };
}

export function buildDeleteEncounterPresetRequest({
  encounterId,
  requestId
}: {
  encounterId: string;
} & OptionalRequestId): ProtocolRequest<"delete_encounter_preset"> {
  return {
    ...requestIdField(requestId),
    type: "delete_encounter_preset",
    encounter_id: encounterId
  };
}

export function buildSpawnEncounterPresetRequest({
  encounterId,
  requestId
}: {
  encounterId: string;
} & OptionalRequestId): ProtocolRequest<"spawn_encounter_preset"> {
  return {
    ...requestIdField(requestId),
    type: "spawn_encounter_preset",
    encounter_id: encounterId
  };
}

export function buildSetInstancedSheetResourceRequest({
  instanceId,
  resource,
  value,
  requestId
}: {
  instanceId: string;
  resource: SheetResourceName;
  value: number;
} & OptionalRequestId): ProtocolRequest<"set_instanced_sheet_resource"> {
  return {
    ...requestIdField(requestId),
    type: "set_instanced_sheet_resource",
    instance_id: instanceId,
    resource,
    value
  };
}

export function buildSetInstancedSheetNotesRequest({
  instanceId,
  notes,
  requestId
}: {
  instanceId: string;
  notes: string;
} & OptionalRequestId): ProtocolRequest<"set_instanced_sheet_notes"> {
  return {
    ...requestIdField(requestId),
    type: "set_instanced_sheet_notes",
    instance_id: instanceId,
    notes
  };
}

export function buildAdjustInstancedSheetResourceRequest({
  instanceId,
  resource,
  delta,
  requestId
}: {
  instanceId: string;
  resource: SheetResourceName;
  delta: number;
} & OptionalRequestId): ProtocolRequest<"adjust_instanced_sheet_resource"> {
  return {
    ...requestIdField(requestId),
    type: "adjust_instanced_sheet_resource",
    instance_id: instanceId,
    resource,
    delta
  };
}

export function buildAdjustInstancedSheetReactionsRequest({
  instanceId,
  delta,
  requestId
}: {
  instanceId: string;
  delta: number;
} & OptionalRequestId): ProtocolRequest<"adjust_instanced_sheet_reactions"> {
  return {
    ...requestIdField(requestId),
    type: "adjust_instanced_sheet_reactions",
    instance_id: instanceId,
    delta
  };
}

export function buildResetInstancedSheetReactionsRequest({
  instanceId,
  requestId
}: { instanceId: string } & OptionalRequestId): ProtocolRequest<"reset_instanced_sheet_reactions"> {
  return {
    ...requestIdField(requestId),
    type: "reset_instanced_sheet_reactions",
    instance_id: instanceId
  };
}

export function buildSetContributionPointsRequest({
  instanceId,
  value,
  reason,
  requestId
}: {
  instanceId: string;
  value: number;
  reason?: string;
} & OptionalRequestId): ProtocolRequest<"set_contribution_points"> {
  return {
    ...requestIdField(requestId),
    type: "set_contribution_points",
    instance_id: instanceId,
    value,
    reason: reason ?? ""
  };
}

export function buildAdjustContributionPointsRequest({
  instanceId,
  delta,
  reason,
  requestId
}: {
  instanceId: string;
  delta: number;
  reason?: string;
} & OptionalRequestId): ProtocolRequest<"adjust_contribution_points"> {
  return {
    ...requestIdField(requestId),
    type: "adjust_contribution_points",
    instance_id: instanceId,
    delta,
    reason: reason ?? ""
  };
}

export function buildSetPinnedInstanceActionsRequest({
  instanceId,
  actionRelationshipIds,
  requestId
}: {
  instanceId: string;
  actionRelationshipIds: string[];
} & OptionalRequestId): ProtocolRequest<"set_pinned_instance_actions"> {
  return {
    ...requestIdField(requestId),
    type: "set_pinned_instance_actions",
    instance_id: instanceId,
    action_relationship_ids: actionRelationshipIds
  };
}

export function buildApplyInstancedSheetDamageRequest({
  instanceId,
  amount,
  damageType,
  requestId
}: {
  instanceId: string;
  amount: number;
  damageType: InstancedSheetDamageType;
} & OptionalRequestId): ProtocolRequest<"apply_instanced_sheet_damage"> {
  return {
    ...requestIdField(requestId),
    type: "apply_instanced_sheet_damage",
    instance_id: instanceId,
    amount,
    damage_type: damageType
  };
}

export function buildSetSheetBaseStatRequest({
  sheetId,
  statName,
  value,
  requestId
}: {
  sheetId: string;
  statName: SheetCoreStatName;
  value: number;
} & OptionalRequestId): ProtocolRequest<"set_sheet_base_stat"> {
  return {
    ...requestIdField(requestId),
    type: "set_sheet_base_stat",
    sheet_id: sheetId,
    stat_name: statName,
    value
  };
}

export function buildSetInstancedSheetBaseStatRequest({
  instanceId,
  statName,
  value,
  requestId
}: {
  instanceId: string;
  statName: SheetCoreStatName;
  value: number;
} & OptionalRequestId): ProtocolRequest<"set_instanced_sheet_base_stat"> {
  return {
    ...requestIdField(requestId),
    type: "set_instanced_sheet_base_stat",
    instance_id: instanceId,
    stat_name: statName,
    value
  };
}

export function buildSetInstancedSheetUnassignedStatPointsRequest({
  instanceId,
  value,
  requestId
}: {
  instanceId: string;
  value: number;
} & OptionalRequestId): ProtocolRequest<"set_instanced_sheet_unassigned_stat_points"> {
  return {
    ...requestIdField(requestId),
    type: "set_instanced_sheet_unassigned_stat_points",
    instance_id: instanceId,
    value
  };
}

export function buildAllocateInstancedSheetStatPointsRequest({
  instanceId,
  allocations,
  requestId
}: {
  instanceId: string;
  allocations: SheetStatPointAllocations;
} & OptionalRequestId): ProtocolRequest<"allocate_instanced_sheet_stat_points"> {
  return {
    ...requestIdField(requestId),
    type: "allocate_instanced_sheet_stat_points",
    instance_id: instanceId,
    allocations
  };
}

export function buildSetSheetFormulaStatRequest({
  sheetId,
  statName,
  formula,
  requestId
}: {
  sheetId: string;
  statName: SheetFormulaStatName;
  formula: FormulaPayload;
} & OptionalRequestId): ProtocolRequest<"set_sheet_formula_stat"> {
  return {
    ...requestIdField(requestId),
    type: "set_sheet_formula_stat",
    sheet_id: sheetId,
    stat_name: statName,
    formula
  };
}

export function buildSetInstancedSheetFormulaStatRequest({
  instanceId,
  statName,
  formula,
  requestId
}: {
  instanceId: string;
  statName: SheetFormulaStatName;
  formula: FormulaPayload;
} & OptionalRequestId): ProtocolRequest<"set_instanced_sheet_formula_stat"> {
  return {
    ...requestIdField(requestId),
    type: "set_instanced_sheet_formula_stat",
    instance_id: instanceId,
    stat_name: statName,
    formula
  };
}

export function buildSetSheetAttributeValueRequest({
  sheetId,
  attributeId,
  value,
  requestId
}: {
  sheetId: string;
  attributeId: string;
  value: AttributeValuePayload;
} & OptionalRequestId): ProtocolRequest<"set_sheet_attribute_value"> {
  return {
    ...requestIdField(requestId),
    type: "set_sheet_attribute_value",
    sheet_id: sheetId,
    attribute_id: attributeId,
    value
  };
}

export function buildSetInstancedSheetAttributeValueRequest({
  instanceId,
  attributeId,
  value,
  requestId
}: {
  instanceId: string;
  attributeId: string;
  value: AttributeValuePayload;
} & OptionalRequestId): ProtocolRequest<"set_instanced_sheet_attribute_value"> {
  return {
    ...requestIdField(requestId),
    type: "set_instanced_sheet_attribute_value",
    instance_id: instanceId,
    attribute_id: attributeId,
    value
  };
}

export function buildCreateAttributeRequest({
  attribute,
  requestId
}: {
  attribute: AttributeDefinitionPayload;
} & OptionalRequestId): ProtocolRequest<"create_attribute"> {
  return {
    ...requestIdField(requestId),
    type: "create_attribute",
    attribute
  };
}

export function buildUpdateAttributeRequest({
  attributeId,
  attribute,
  requestId
}: {
  attributeId: string;
  attribute: AttributeDefinitionPayload;
} & OptionalRequestId): ProtocolRequest<"update_attribute"> {
  return {
    ...requestIdField(requestId),
    type: "update_attribute",
    attribute_id: attributeId,
    attribute
  };
}

export function buildDeleteAttributeRequest({
  attributeId,
  requestId
}: {
  attributeId: string;
} & OptionalRequestId): ProtocolRequest<"delete_attribute"> {
  return {
    ...requestIdField(requestId),
    type: "delete_attribute",
    attribute_id: attributeId
  };
}

export function buildAttachSheetAttributeRequest({
  sheetId,
  relationshipId,
  attributeId,
  value,
  requestId
}: {
  sheetId: string;
  relationshipId: string;
  attributeId: string;
  value?: AttributeValuePayload;
} & OptionalRequestId): ProtocolRequest<"attach_sheet_attribute"> {
  return {
    ...requestIdField(requestId),
    type: "attach_sheet_attribute",
    sheet_id: sheetId,
    relationship_id: relationshipId,
    attribute_id: attributeId,
    ...(value === undefined ? {} : { value })
  };
}

export function buildAttachInstancedSheetAttributeRequest({
  instanceId,
  relationshipId,
  attributeId,
  value,
  requestId
}: {
  instanceId: string;
  relationshipId: string;
  attributeId: string;
  value?: AttributeValuePayload;
} & OptionalRequestId): ProtocolRequest<"attach_instanced_sheet_attribute"> {
  return {
    ...requestIdField(requestId),
    type: "attach_instanced_sheet_attribute",
    instance_id: instanceId,
    relationship_id: relationshipId,
    attribute_id: attributeId,
    ...(value === undefined ? {} : { value })
  };
}

export function buildDetachSheetAttributeRequest({
  sheetId,
  attributeId,
  requestId
}: {
  sheetId: string;
  attributeId: string;
} & OptionalRequestId): ProtocolRequest<"detach_sheet_attribute"> {
  return {
    ...requestIdField(requestId),
    type: "detach_sheet_attribute",
    sheet_id: sheetId,
    attribute_id: attributeId
  };
}

export function buildDetachInstancedSheetAttributeRequest({
  instanceId,
  attributeId,
  requestId
}: {
  instanceId: string;
  attributeId: string;
} & OptionalRequestId): ProtocolRequest<"detach_instanced_sheet_attribute"> {
  return {
    ...requestIdField(requestId),
    type: "detach_instanced_sheet_attribute",
    instance_id: instanceId,
    attribute_id: attributeId
  };
}

export function buildAttachSubjectAttributeRequest({
  subjectType,
  subjectId,
  relationshipId,
  attributeId,
  value,
  requestId
}: {
  subjectType: "item" | "action";
  subjectId: string;
  relationshipId: string;
  attributeId: string;
  value?: AttributeValuePayload;
} & OptionalRequestId): ProtocolRequest<"attach_subject_attribute"> {
  return {
    ...requestIdField(requestId),
    type: "attach_subject_attribute",
    subject_type: subjectType,
    subject_id: subjectId,
    relationship_id: relationshipId,
    attribute_id: attributeId,
    ...(value === undefined ? {} : { value })
  };
}

export function buildSetSubjectAttributeValueRequest({
  subjectType,
  subjectId,
  attributeId,
  value,
  requestId
}: {
  subjectType: "item" | "action";
  subjectId: string;
  attributeId: string;
  value: AttributeValuePayload;
} & OptionalRequestId): ProtocolRequest<"set_subject_attribute_value"> {
  return {
    ...requestIdField(requestId),
    type: "set_subject_attribute_value",
    subject_type: subjectType,
    subject_id: subjectId,
    attribute_id: attributeId,
    value
  };
}

export function buildResetSubjectAttributeValueRequest({
  subjectType,
  subjectId,
  attributeId,
  requestId
}: {
  subjectType: "item" | "action";
  subjectId: string;
  attributeId: string;
} & OptionalRequestId): ProtocolRequest<"reset_subject_attribute_value"> {
  return {
    ...requestIdField(requestId),
    type: "reset_subject_attribute_value",
    subject_type: subjectType,
    subject_id: subjectId,
    attribute_id: attributeId
  };
}

export function buildDetachSubjectAttributeRequest({
  subjectType,
  subjectId,
  attributeId,
  requestId
}: {
  subjectType: "item" | "action";
  subjectId: string;
  attributeId: string;
} & OptionalRequestId): ProtocolRequest<"detach_subject_attribute"> {
  return {
    ...requestIdField(requestId),
    type: "detach_subject_attribute",
    subject_type: subjectType,
    subject_id: subjectId,
    attribute_id: attributeId
  };
}

export function buildResetSheetAttributeValueRequest({
  sheetId,
  attributeId,
  requestId
}: {
  sheetId: string;
  attributeId: string;
} & OptionalRequestId): ProtocolRequest<"reset_sheet_attribute_value"> {
  return {
    ...requestIdField(requestId),
    type: "reset_sheet_attribute_value",
    sheet_id: sheetId,
    attribute_id: attributeId
  };
}

export function buildResetInstancedSheetAttributeValueRequest({
  instanceId,
  attributeId,
  requestId
}: {
  instanceId: string;
  attributeId: string;
} & OptionalRequestId): ProtocolRequest<"reset_instanced_sheet_attribute_value"> {
  return {
    ...requestIdField(requestId),
    type: "reset_instanced_sheet_attribute_value",
    instance_id: instanceId,
    attribute_id: attributeId
  };
}

export function buildSetSheetResistancesRequest({
  sheetId,
  resistances,
  requestId
}: {
  sheetId: string;
  resistances: SheetResistancesPayload;
} & OptionalRequestId): ProtocolRequest<"set_sheet_resistances"> {
  return {
    ...requestIdField(requestId),
    type: "set_sheet_resistances",
    sheet_id: sheetId,
    resistances
  };
}

export function buildSetInstancedSheetResistancesRequest({
  instanceId,
  resistances,
  requestId
}: {
  instanceId: string;
  resistances: InstancedSheetResistancesUpdatePayload;
} & OptionalRequestId): ProtocolRequest<"set_instanced_sheet_resistances"> {
  return {
    ...requestIdField(requestId),
    type: "set_instanced_sheet_resistances",
    instance_id: instanceId,
    resistances
  };
}

export function buildSetSheetNotesRequest({
  sheetId,
  notes,
  requestId
}: {
  sheetId: string;
  notes: string;
} & OptionalRequestId): ProtocolRequest<"set_sheet_notes"> {
  return {
    ...requestIdField(requestId),
    type: "set_sheet_notes",
    sheet_id: sheetId,
    notes
  };
}

export function buildAttachSheetActionRequest({
  sheetId,
  bridge,
  requestId
}: {
  sheetId: string;
  bridge: SheetActionBridgePayload;
} & OptionalRequestId): ProtocolRequest<"create_sheet_action_bridge"> {
  return {
    ...requestIdField(requestId),
    type: "create_sheet_action_bridge",
    sheet_id: sheetId,
    bridge
  };
}

export function buildAttachInstancedSheetActionRequest({
  instanceId,
  bridge,
  requestId
}: {
  instanceId: string;
  bridge: InstancedSheetActionBridgePayload;
} & OptionalRequestId): ProtocolRequest<"create_instanced_sheet_action_bridge"> {
  return {
    ...requestIdField(requestId),
    type: "create_instanced_sheet_action_bridge",
    instance_id: instanceId,
    bridge
  };
}

export function buildRelinkSheetActionRequest({
  sheetId,
  relationshipId,
  bridge,
  requestId
}: {
  sheetId: string;
  relationshipId: string;
  bridge: SheetActionBridgePayload;
} & OptionalRequestId): ProtocolRequest<"update_sheet_action_bridge"> {
  return {
    ...requestIdField(requestId),
    type: "update_sheet_action_bridge",
    sheet_id: sheetId,
    relationship_id: relationshipId,
    bridge
  };
}

export function buildRelinkInstancedSheetActionRequest({
  instanceId,
  relationshipId,
  bridge,
  requestId
}: {
  instanceId: string;
  relationshipId: string;
  bridge: InstancedSheetActionBridgePayload;
} & OptionalRequestId): ProtocolRequest<"update_instanced_sheet_action_bridge"> {
  return {
    ...requestIdField(requestId),
    type: "update_instanced_sheet_action_bridge",
    instance_id: instanceId,
    relationship_id: relationshipId,
    bridge
  };
}

export function buildDetachSheetActionRequest({
  sheetId,
  relationshipId,
  requestId
}: {
  sheetId: string;
  relationshipId: string;
} & OptionalRequestId): ProtocolRequest<"delete_sheet_action_bridge"> {
  return {
    ...requestIdField(requestId),
    type: "delete_sheet_action_bridge",
    sheet_id: sheetId,
    relationship_id: relationshipId
  };
}

export function buildDetachInstancedSheetActionRequest({
  instanceId,
  relationshipId,
  requestId
}: {
  instanceId: string;
  relationshipId: string;
} & OptionalRequestId): ProtocolRequest<"delete_instanced_sheet_action_bridge"> {
  return {
    ...requestIdField(requestId),
    type: "delete_instanced_sheet_action_bridge",
    instance_id: instanceId,
    relationship_id: relationshipId
  };
}

export function buildAttachSheetItemRequest({
  sheetId,
  bridge,
  requestId
}: {
  sheetId: string;
  bridge: SheetItemBridgePayload;
} & OptionalRequestId): ProtocolRequest<"create_sheet_item_bridge"> {
  return {
    ...requestIdField(requestId),
    type: "create_sheet_item_bridge",
    sheet_id: sheetId,
    bridge
  };
}

export function buildUpdateAttachedSheetItemRequest({
  sheetId,
  relationshipId,
  bridge,
  requestId
}: {
  sheetId: string;
  relationshipId: string;
  bridge: SheetItemBridgePayload;
} & OptionalRequestId): ProtocolRequest<"update_sheet_item_bridge"> {
  return {
    ...requestIdField(requestId),
    type: "update_sheet_item_bridge",
    sheet_id: sheetId,
    relationship_id: relationshipId,
    bridge
  };
}

export function buildDetachSheetItemRequest({
  sheetId,
  relationshipId,
  requestId
}: {
  sheetId: string;
  relationshipId: string;
} & OptionalRequestId): ProtocolRequest<"delete_sheet_item_bridge"> {
  return {
    ...requestIdField(requestId),
    type: "delete_sheet_item_bridge",
    sheet_id: sheetId,
    relationship_id: relationshipId
  };
}

export function buildAttachInstancedSheetItemRequest({
  instanceId,
  bridge,
  requestId
}: {
  instanceId: string;
  bridge: SheetItemBridgePayload;
} & OptionalRequestId): ProtocolRequest<"create_instanced_sheet_item_bridge"> {
  return {
    ...requestIdField(requestId),
    type: "create_instanced_sheet_item_bridge",
    instance_id: instanceId,
    bridge
  };
}

export function buildUpdateInstancedSheetItemRequest({
  instanceId,
  relationshipId,
  bridge,
  requestId
}: {
  instanceId: string;
  relationshipId: string;
  bridge: SheetItemBridgePayload;
} & OptionalRequestId): ProtocolRequest<"update_instanced_sheet_item_bridge"> {
  return {
    ...requestIdField(requestId),
    type: "update_instanced_sheet_item_bridge",
    instance_id: instanceId,
    relationship_id: relationshipId,
    bridge
  };
}

export function buildDetachInstancedSheetItemRequest({
  instanceId,
  relationshipId,
  requestId
}: {
  instanceId: string;
  relationshipId: string;
} & OptionalRequestId): ProtocolRequest<"delete_instanced_sheet_item_bridge"> {
  return {
    ...requestIdField(requestId),
    type: "delete_instanced_sheet_item_bridge",
    instance_id: instanceId,
    relationship_id: relationshipId
  };
}

export function buildMoveInstancedSheetItemRequest({
  instanceId,
  relationshipId,
  parentContainerId,
  requestId
}: {
  instanceId: string;
  relationshipId: string;
  parentContainerId: string | null;
} & OptionalRequestId): ProtocolRequest<"move_instanced_sheet_item"> {
  return {
    ...requestIdField(requestId),
    type: "move_instanced_sheet_item",
    instance_id: instanceId,
    relationship_id: relationshipId,
    parent_container_id: parentContainerId
  };
}

export function buildSetInstancedSheetItemEquippedRequest({
  instanceId,
  relationshipId,
  equipped,
  requestId
}: {
  instanceId: string;
  relationshipId: string;
  equipped: boolean;
} & OptionalRequestId): ProtocolRequest<"set_instanced_sheet_item_equipped"> {
  return {
    ...requestIdField(requestId),
    type: "set_instanced_sheet_item_equipped",
    instance_id: instanceId,
    relationship_id: relationshipId,
    equipped
  };
}

export function buildLinkSheetProficiencyRequest({
  sheetId,
  bridge,
  requestId
}: {
  sheetId: string;
  bridge: SheetProficiencyBridgePayload;
} & OptionalRequestId): ProtocolRequest<"create_sheet_proficiency_bridge"> {
  return {
    ...requestIdField(requestId),
    type: "create_sheet_proficiency_bridge",
    sheet_id: sheetId,
    bridge
  };
}

export function buildLinkInstancedSheetProficiencyRequest({
  instanceId,
  bridge,
  requestId
}: {
  instanceId: string;
  bridge: InstancedSheetProficiencyBridgePayload;
} & OptionalRequestId): ProtocolRequest<"create_instanced_sheet_proficiency_bridge"> {
  return {
    ...requestIdField(requestId),
    type: "create_instanced_sheet_proficiency_bridge",
    instance_id: instanceId,
    bridge
  };
}

export function buildUpdateLinkedSheetProficiencyRequest({
  sheetId,
  relationshipId,
  bridge,
  requestId
}: {
  sheetId: string;
  relationshipId: string;
  bridge: SheetProficiencyBridgePayload;
} & OptionalRequestId): ProtocolRequest<"update_sheet_proficiency_bridge"> {
  return {
    ...requestIdField(requestId),
    type: "update_sheet_proficiency_bridge",
    sheet_id: sheetId,
    relationship_id: relationshipId,
    bridge
  };
}

export function buildUpdateLinkedInstancedSheetProficiencyRequest({
  instanceId,
  relationshipId,
  bridge,
  requestId
}: {
  instanceId: string;
  relationshipId: string;
  bridge: InstancedSheetProficiencyBridgePayload;
} & OptionalRequestId): ProtocolRequest<"update_instanced_sheet_proficiency_bridge"> {
  return {
    ...requestIdField(requestId),
    type: "update_instanced_sheet_proficiency_bridge",
    instance_id: instanceId,
    relationship_id: relationshipId,
    bridge
  };
}

export function buildUnlinkSheetProficiencyRequest({
  sheetId,
  relationshipId,
  requestId
}: {
  sheetId: string;
  relationshipId: string;
} & OptionalRequestId): ProtocolRequest<"delete_sheet_proficiency_bridge"> {
  return {
    ...requestIdField(requestId),
    type: "delete_sheet_proficiency_bridge",
    sheet_id: sheetId,
    relationship_id: relationshipId
  };
}

export function buildUnlinkInstancedSheetProficiencyRequest({
  instanceId,
  relationshipId,
  requestId
}: {
  instanceId: string;
  relationshipId: string;
} & OptionalRequestId): ProtocolRequest<"delete_instanced_sheet_proficiency_bridge"> {
  return {
    ...requestIdField(requestId),
    type: "delete_instanced_sheet_proficiency_bridge",
    instance_id: instanceId,
    relationship_id: relationshipId
  };
}

export function buildCreateSheetRequest({
  sheet,
  requestId
}: {
  sheet: SheetDefinitionPayload;
} & OptionalRequestId): ProtocolRequest<"create_sheet"> {
  return {
    ...requestIdField(requestId),
    type: "create_sheet",
    sheet
  };
}

export function buildCreateSheetFromInstanceRequest({
  instanceId,
  sheetId,
  name,
  notes,
  dmOnly,
  requestId
}: {
  instanceId: string;
  sheetId: string;
  name: string;
  notes?: string | null;
  dmOnly?: boolean | null;
} & OptionalRequestId): ProtocolRequest<"create_sheet_from_instance"> {
  return {
    ...requestIdField(requestId),
    type: "create_sheet_from_instance",
    instance_id: instanceId,
    sheet_id: sheetId,
    name,
    ...(notes === undefined ? {} : { notes }),
    ...(dmOnly === undefined ? {} : { dm_only: dmOnly })
  };
}

export function buildUpdateSheetRequest({
  sheetId,
  sheet,
  requestId
}: {
  sheetId: string;
  sheet: SheetDefinitionPayload;
} & OptionalRequestId): ProtocolRequest<"update_sheet"> {
  return {
    ...requestIdField(requestId),
    type: "update_sheet",
    sheet_id: sheetId,
    sheet
  };
}

export function buildDeleteSheetRequest({
  sheetId,
  requestId
}: {
  sheetId: string;
} & OptionalRequestId): ProtocolRequest<"delete_sheet"> {
  return {
    ...requestIdField(requestId),
    type: "delete_sheet",
    sheet_id: sheetId
  };
}

export function buildInstantiateSheetRequest({
  instanceId,
  parentSheetId,
  health,
  mana,
  notes,
  resistances,
  generateAccessCode,
  requestId
}: {
  instanceId: string;
  parentSheetId: string;
  health?: number;
  mana?: number;
  notes?: string;
  resistances?: InstancedSheetResistancesPayload;
  generateAccessCode?: boolean;
} & OptionalRequestId): ProtocolRequest<"create_instanced_sheet"> {
  return {
    ...requestIdField(requestId),
    type: "create_instanced_sheet",
    instance_id: instanceId,
    parent_sheet_id: parentSheetId,
    ...(health === undefined ? {} : { health }),
    ...(mana === undefined ? {} : { mana }),
    ...(notes === undefined ? {} : { notes }),
    ...(resistances === undefined ? {} : { resistances }),
    ...(generateAccessCode === undefined ? {} : { generate_access_code: generateAccessCode })
  };
}

export function buildDeleteInstancedSheetRequest({
  instanceId,
  requestId
}: {
  instanceId: string;
} & OptionalRequestId): ProtocolRequest<"delete_instanced_sheet"> {
  return {
    ...requestIdField(requestId),
    type: "delete_instanced_sheet",
    instance_id: instanceId
  };
}

export const buildCreateSheetActionBridgeRequest = buildAttachSheetActionRequest;
export const buildUpdateSheetActionBridgeRequest = buildRelinkSheetActionRequest;
export const buildDeleteSheetActionBridgeRequest = buildDetachSheetActionRequest;
export const buildCreateInstancedSheetActionBridgeRequest = buildAttachInstancedSheetActionRequest;
export const buildUpdateInstancedSheetActionBridgeRequest = buildRelinkInstancedSheetActionRequest;
export const buildDeleteInstancedSheetActionBridgeRequest = buildDetachInstancedSheetActionRequest;
export const buildCreateSheetItemBridgeRequest = buildAttachSheetItemRequest;
export const buildUpdateSheetItemBridgeRequest = buildUpdateAttachedSheetItemRequest;
export const buildDeleteSheetItemBridgeRequest = buildDetachSheetItemRequest;
export const buildCreateSheetProficiencyBridgeRequest = buildLinkSheetProficiencyRequest;
export const buildUpdateSheetProficiencyBridgeRequest = buildUpdateLinkedSheetProficiencyRequest;
export const buildDeleteSheetProficiencyBridgeRequest = buildUnlinkSheetProficiencyRequest;
export const buildCreateInstancedSheetProficiencyBridgeRequest =
  buildLinkInstancedSheetProficiencyRequest;
export const buildUpdateInstancedSheetProficiencyBridgeRequest =
  buildUpdateLinkedInstancedSheetProficiencyRequest;
export const buildDeleteInstancedSheetProficiencyBridgeRequest =
  buildUnlinkInstancedSheetProficiencyRequest;
export const buildCreateInstancedSheetRequest = buildInstantiateSheetRequest;

export function buildCreateItemRequest({
  item,
  requestId
}: {
  item: ItemDefinitionPayload;
} & OptionalRequestId): ProtocolRequest<"create_item"> {
  return {
    ...requestIdField(requestId),
    type: "create_item",
    item
  };
}

export function buildUpdateItemRequest({
  itemId,
  item,
  requestId
}: {
  itemId: string;
  item: ItemDefinitionPayload;
} & OptionalRequestId): ProtocolRequest<"update_item"> {
  return {
    ...requestIdField(requestId),
    type: "update_item",
    item_id: itemId,
    item
  };
}

export function buildDeleteItemRequest({
  itemId,
  requestId
}: {
  itemId: string;
} & OptionalRequestId): ProtocolRequest<"delete_item"> {
  return {
    ...requestIdField(requestId),
    type: "delete_item",
    item_id: itemId
  };
}

export function buildAddPlayerInventoryItemRequest({
  itemId,
  requestId
}: {
  itemId: string;
} & OptionalRequestId): ProtocolRequest<"add_player_inventory_item"> {
  return {
    ...requestIdField(requestId),
    type: "add_player_inventory_item",
    item_id: itemId
  };
}

export function buildRemovePlayerInventoryItemRequest({
  relationshipId,
  requestId
}: {
  relationshipId: string;
} & OptionalRequestId): ProtocolRequest<"remove_player_inventory_item"> {
  return {
    ...requestIdField(requestId),
    type: "remove_player_inventory_item",
    relationship_id: relationshipId
  };
}

export function buildSubmitPlayerItemRequest({
  item,
  requestId
}: {
  item: PlayerItemSubmissionPayload;
} & OptionalRequestId): ProtocolRequest<"submit_player_item"> {
  return {
    ...requestIdField(requestId),
    type: "submit_player_item",
    item
  };
}

export function buildReviewPlayerItemRequest({
  itemId,
  approved,
  requestId
}: {
  itemId: string;
  approved: boolean;
} & OptionalRequestId): ProtocolRequest<"review_player_item"> {
  return {
    ...requestIdField(requestId),
    type: "review_player_item",
    item_id: itemId,
    approved
  };
}

export function buildCreateProficiencyRequest({
  proficiency,
  requestId
}: {
  proficiency: ProficiencyDefinitionPayload;
} & OptionalRequestId): ProtocolRequest<"create_proficiency"> {
  return {
    ...requestIdField(requestId),
    type: "create_proficiency",
    proficiency
  };
}

export function buildUpdateProficiencyRequest({
  proficiencyId,
  proficiency,
  requestId
}: {
  proficiencyId: string;
  proficiency: ProficiencyDefinitionPayload;
} & OptionalRequestId): ProtocolRequest<"update_proficiency"> {
  return {
    ...requestIdField(requestId),
    type: "update_proficiency",
    proficiency_id: proficiencyId,
    proficiency
  };
}

export function buildDeleteProficiencyRequest({
  proficiencyId,
  requestId
}: {
  proficiencyId: string;
} & OptionalRequestId): ProtocolRequest<"delete_proficiency"> {
  return {
    ...requestIdField(requestId),
    type: "delete_proficiency",
    proficiency_id: proficiencyId
  };
}

export function buildUpsertItemAugmentationTemplateRequest({
  itemId,
  augmentation,
  requestId
}: {
  itemId: string;
  augmentation: AugmentationPayload;
} & OptionalRequestId): ProtocolRequest<"upsert_item_augmentation_template"> {
  return {
    ...requestIdField(requestId),
    type: "upsert_item_augmentation_template",
    item_id: itemId,
    augmentation
  };
}

export function buildRemoveItemAugmentationTemplateRequest({
  itemId,
  augmentationId,
  requestId
}: {
  itemId: string;
  augmentationId: string;
} & OptionalRequestId): ProtocolRequest<"remove_item_augmentation_template"> {
  return {
    ...requestIdField(requestId),
    type: "remove_item_augmentation_template",
    item_id: itemId,
    augmentation_id: augmentationId
  };
}

export function buildCreateFormulaRequest({
  formula,
  requestId
}: {
  formula: FormulaDefinitionPayload;
} & OptionalRequestId): ProtocolRequest<"create_formula"> {
  return {
    ...requestIdField(requestId),
    type: "create_formula",
    formula
  };
}

export function buildUpdateFormulaRequest({
  formulaId,
  formula,
  requestId
}: {
  formulaId: string;
  formula: FormulaDefinitionPayload;
} & OptionalRequestId): ProtocolRequest<"update_formula"> {
  return {
    ...requestIdField(requestId),
    type: "update_formula",
    formula_id: formulaId,
    formula
  };
}

export function buildDeleteFormulaRequest({
  formulaId,
  requestId
}: {
  formulaId: string;
} & OptionalRequestId): ProtocolRequest<"delete_formula"> {
  return {
    ...requestIdField(requestId),
    type: "delete_formula",
    formula_id: formulaId
  };
}

export function buildCreateActionRequest({
  action,
  requestId
}: {
  action: ActionDefinitionPayload;
} & OptionalRequestId): ProtocolRequest<"create_action"> {
  return {
    ...requestIdField(requestId),
    type: "create_action",
    action
  };
}

export function buildUpdateActionRequest({
  actionId,
  action,
  requestId
}: {
  actionId: string;
  action: ActionDefinitionPayload;
} & OptionalRequestId): ProtocolRequest<"update_action"> {
  return {
    ...requestIdField(requestId),
    type: "update_action",
    action_id: actionId,
    action
  };
}

export function buildDeleteActionRequest({
  actionId,
  requestId
}: {
  actionId: string;
} & OptionalRequestId): ProtocolRequest<"delete_action"> {
  return {
    ...requestIdField(requestId),
    type: "delete_action",
    action_id: actionId
  };
}

export function buildCreateConditionPresetRequest({
  condition,
  requestId
}: {
  condition: ConditionPresetPayload;
} & OptionalRequestId): ProtocolRequest<"create_condition_preset"> {
  return {
    ...requestIdField(requestId),
    type: "create_condition_preset",
    condition
  };
}

export function buildUpdateConditionPresetRequest({
  conditionId,
  conditionPartial,
  requestId
}: {
  conditionId: string;
  conditionPartial: ProtocolRequest<"update_condition_preset">["condition_partial"];
} & OptionalRequestId): ProtocolRequest<"update_condition_preset"> {
  return {
    ...requestIdField(requestId),
    type: "update_condition_preset",
    condition_id: conditionId,
    condition_partial: conditionPartial
  };
}

export function buildDeleteConditionPresetRequest({
  conditionId,
  requestId
}: {
  conditionId: string;
} & OptionalRequestId): ProtocolRequest<"delete_condition_preset"> {
  return {
    ...requestIdField(requestId),
    type: "delete_condition_preset",
    condition_id: conditionId
  };
}

export function buildCreateStandaloneEffectRequest({
  effect,
  requestId
}: {
  effect: StandaloneEffectDefinitionPayload;
} & OptionalRequestId): ProtocolRequest<"create_standalone_effect"> {
  return {
    ...requestIdField(requestId),
    type: "create_standalone_effect",
    effect
  };
}

export function buildUpdateStandaloneEffectRequest({
  effectId,
  effect,
  requestId
}: {
  effectId: string;
  effect: StandaloneEffectDefinitionPayload;
} & OptionalRequestId): ProtocolRequest<"update_standalone_effect"> {
  return {
    ...requestIdField(requestId),
    type: "update_standalone_effect",
    effect_id: effectId,
    effect
  };
}

export function buildDeleteStandaloneEffectRequest({
  effectId,
  requestId
}: {
  effectId: string;
} & OptionalRequestId): ProtocolRequest<"delete_standalone_effect"> {
  return {
    ...requestIdField(requestId),
    type: "delete_standalone_effect",
    effect_id: effectId
  };
}

export function buildRemoveActiveConditionRequest({
  instanceId,
  applicationId,
  requestId
}: {
  instanceId: string;
  applicationId: string;
} & OptionalRequestId): ProtocolRequest<"remove_active_condition"> {
  return {
    ...requestIdField(requestId),
    type: "remove_active_condition",
    instance_id: instanceId,
    application_id: applicationId
  };
}

export function buildGetActionFormulaAuthoringMetadataRequest({
  requestId
}: OptionalRequestId = {}): ProtocolRequest<"get_action_formula_authoring_metadata"> {
  return {
    ...requestIdField(requestId),
    type: "get_action_formula_authoring_metadata"
  };
}

export function buildGetAugmentationTargetMetadataRequest({
  context,
  requestId
}: {
  context?: AugmentationTargetContext | null;
} & OptionalRequestId = {}): ProtocolRequest<"get_augmentation_target_metadata"> {
  return {
    ...requestIdField(requestId),
    type: "get_augmentation_target_metadata",
    ...(context === undefined ? {} : { context })
  };
}

export function buildPerformActionRequest({
  sheetId,
  actionId,
  sourceItemRelationshipId,
  targetSheetId,
  rollMode,
  visibility,
  requestId
}: {
  sheetId: string;
  actionId: string;
  sourceItemRelationshipId?: string | null;
  targetSheetId?: string | null;
  rollMode?: ActionRollMode;
  visibility?: ActionExecutionVisibility;
} & OptionalRequestId): ProtocolRequest<"perform_action"> {
  return {
    ...requestIdField(requestId),
    type: "perform_action",
    sheet_id: sheetId,
    action_id: actionId,
    ...(sourceItemRelationshipId === undefined
      ? {}
      : { source_item_relationship_id: sourceItemRelationshipId }),
    ...(targetSheetId === undefined ? {} : { target_sheet_id: targetSheetId }),
    ...(rollMode === undefined ? {} : { roll_mode: rollMode }),
    ...(visibility === undefined ? {} : { visibility })
  };
}

export function buildResyncStateRequest({
  lastSeenVersion,
  requestId
}: {
  lastSeenVersion?: number | null;
} & OptionalRequestId = {}): ProtocolRequest<"resync_state"> {
  return {
    ...requestIdField(requestId),
    type: "resync_state",
    ...(lastSeenVersion === undefined ? {} : { last_seen_version: lastSeenVersion })
  };
}

export function buildUndoLastStateChangeRequest({
  requestId
}: OptionalRequestId = {}): ProtocolRequest<"undo_last_state_change"> {
  return {
    ...requestIdField(requestId),
    type: "undo_last_state_change"
  };
}
