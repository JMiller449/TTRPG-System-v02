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
export type SheetItemBridgePayload = ProtocolRequest<"create_sheet_item_bridge">["bridge"];
export type SheetDefinitionPayload = ProtocolRequest<"create_sheet">["sheet"];
export type InstancedSheetResistancesPayload = ProtocolRequest<"create_instanced_sheet">["resistances"];
export type ItemDefinitionPayload = ProtocolRequest<"create_item">["item"];
export type AugmentationPayload = ProtocolRequest<"upsert_item_augmentation_template">["augmentation"];
export type FormulaDefinitionPayload = ProtocolRequest<"create_formula">["formula"];
export type ActionDefinitionPayload = ProtocolRequest<"create_action">["action"];
export type ConditionPresetPayload = ProtocolRequest<"create_condition_preset">["condition"];
export type AugmentationTargetContext = NonNullable<
  ProtocolRequest<"get_augmentation_target_metadata">["context"]
>;

export function buildGetRoll20BridgeStatusRequest({
  requestId
}: OptionalRequestId = {}): ProtocolRequest<"get_roll20_bridge_status"> {
  return {
    ...requestIdField(requestId),
    type: "get_roll20_bridge_status"
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
  requestId
}: {
  sheetId: string;
  actionId: string;
  targetSheetId?: string | null;
} & OptionalRequestId): ProtocolRequest<"perform_action"> {
  return {
    ...requestIdField(requestId),
    type: "perform_action",
    sheet_id: sheetId,
    action_id: actionId,
    ...(targetSheetId === undefined ? {} : { target_sheet_id: targetSheetId })
  };
}
