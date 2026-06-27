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
export type SheetCoreStatName = ProtocolRequest<"set_sheet_base_stat">["stat_name"];
export type SheetFormulaStatName = ProtocolRequest<"set_sheet_formula_stat">["stat_name"];
export type SheetItemBridgePayload = ProtocolRequest<"create_sheet_item_bridge">["bridge"];
export type SheetActionBridgePayload = ProtocolRequest<"create_sheet_action_bridge">["bridge"];
export type SheetProficiencyBridgePayload = ProtocolRequest<"create_sheet_proficiency_bridge">["bridge"];
export type SheetDefinitionPayload = ProtocolRequest<"create_sheet">["sheet"];
export type InstancedSheetResistancesPayload = ProtocolRequest<"create_instanced_sheet">["resistances"];
export type ItemDefinitionPayload = ProtocolRequest<"create_item">["item"];
export type AugmentationPayload = ProtocolRequest<"upsert_item_augmentation_template">["augmentation"];
export type FormulaPayload = ProtocolRequest<"set_sheet_formula_stat">["formula"];
export type FormulaDefinitionPayload = ProtocolRequest<"create_formula">["formula"];
export type ActionDefinitionPayload = ProtocolRequest<"create_action">["action"];
export type ProficiencyDefinitionPayload = ProtocolRequest<"create_proficiency">["proficiency"];
export type ConditionPresetPayload = ProtocolRequest<"create_condition_preset">["condition"];
export type EncounterPresetPayload = ProtocolRequest<"save_encounter_preset">["encounter"];
export type ActionRollMode = NonNullable<ProtocolRequest<"perform_action">["roll_mode"]>;
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

export function buildSetSheetMobKillCountRequest({
  sheetId,
  mobSheetId,
  count,
  requestId
}: {
  sheetId: string;
  mobSheetId: string;
  count: number;
} & OptionalRequestId): ProtocolRequest<"set_sheet_mob_kill_count"> {
  return {
    ...requestIdField(requestId),
    type: "set_sheet_mob_kill_count",
    sheet_id: sheetId,
    mob_sheet_id: mobSheetId,
    count
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

export function buildCreateSheetActionBridgeRequest({
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

export function buildUpdateSheetActionBridgeRequest({
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

export function buildDeleteSheetActionBridgeRequest({
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

export function buildCreateSheetItemBridgeRequest({
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

export function buildUpdateSheetItemBridgeRequest({
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

export function buildDeleteSheetItemBridgeRequest({
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

export function buildCreateSheetProficiencyBridgeRequest({
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

export function buildUpdateSheetProficiencyBridgeRequest({
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

export function buildDeleteSheetProficiencyBridgeRequest({
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

export function buildCreateInstancedSheetRequest({
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
  health: number;
  mana: number;
  notes?: string;
  resistances?: InstancedSheetResistancesPayload;
  generateAccessCode?: boolean;
} & OptionalRequestId): ProtocolRequest<"create_instanced_sheet"> {
  return {
    ...requestIdField(requestId),
    type: "create_instanced_sheet",
    instance_id: instanceId,
    parent_sheet_id: parentSheetId,
    health,
    mana,
    ...(notes === undefined ? {} : { notes }),
    ...(resistances === undefined ? {} : { resistances }),
    ...(generateAccessCode === undefined ? {} : { generate_access_code: generateAccessCode })
  };
}

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
  targetSheetId,
  rollMode,
  requestId
}: {
  sheetId: string;
  actionId: string;
  targetSheetId?: string | null;
  rollMode?: ActionRollMode;
} & OptionalRequestId): ProtocolRequest<"perform_action"> {
  return {
    ...requestIdField(requestId),
    type: "perform_action",
    sheet_id: sheetId,
    action_id: actionId,
    ...(targetSheetId === undefined ? {} : { target_sheet_id: targetSheetId }),
    ...(rollMode === undefined ? {} : { roll_mode: rollMode })
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
