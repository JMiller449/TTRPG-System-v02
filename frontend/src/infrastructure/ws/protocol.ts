import type {
  ActionFormulaAuthoringMetadataEvent as ProtocolActionFormulaAuthoringMetadataEvent,
  ActionExecutedEvent as ProtocolActionExecutedEvent,
  AuthenticateResponseEvent as ProtocolAuthenticateResponseEvent,
  AugmentationTargetMetadataEvent as ProtocolAugmentationTargetMetadataEvent,
  BackendStateSnapshotPayload as ProtocolBackendState,
  ErrorEvent as ProtocolErrorEvent,
  PatchOperation as ProtocolPatchOperation,
  ProtocolApplicationRequest,
  ProtocolServerEvent,
  Roll20BridgeStatusEvent as ProtocolRoll20BridgeStatusEvent,
  Roll20BridgeSyncConfigEvent as ProtocolRoll20BridgeSyncConfigEvent,
  SheetAccessCodesEvent as ProtocolSheetAccessCodesEvent,
  StateBackupExportedEvent as ProtocolStateBackupExportedEvent,
  StatePatchEvent as ProtocolStatePatchEvent,
  StateSnapshotEvent as ProtocolStateSnapshotEvent,
  XpTrackerEvent as ProtocolXpTrackerEvent
} from "@/generated/backendProtocol";

export type {
  ProtocolActionFormulaAuthoringMetadataEvent,
  ProtocolActionExecutedEvent,
  ProtocolAugmentationTargetMetadataEvent,
  ProtocolApplicationRequest,
  ProtocolAuthenticateResponseEvent,
  ProtocolBackendState,
  ProtocolErrorEvent,
  ProtocolPatchOperation,
  ProtocolRoll20BridgeStatusEvent,
  ProtocolRoll20BridgeSyncConfigEvent,
  ProtocolSheetAccessCodesEvent,
  ProtocolServerEvent,
  ProtocolStateBackupExportedEvent,
  ProtocolStatePatchEvent,
  ProtocolStateSnapshotEvent,
  ProtocolXpTrackerEvent
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null | undefined {
  return typeof value === "string" || value === null || value === undefined;
}

function isPatchOperation(value: unknown): value is ProtocolPatchOperation {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.op === "set" || value.op === "inc" || value.op === "add" || value.op === "remove") &&
    typeof value.path === "string"
  );
}

export function parseProtocolServerEvent(payload: unknown): ProtocolServerEvent | null {
  if (!isRecord(payload) || typeof payload.type !== "string") {
    return null;
  }

  switch (payload.type) {
    case "authenticate_response":
      if (
        typeof payload.authenticated === "boolean" &&
        (payload.role === "player" ||
          payload.role === "dm" ||
          payload.role === "service" ||
          payload.role === null) &&
        isNullableString(payload.reason)
      ) {
        return {
          response_id:
            typeof payload.response_id === "string" || payload.response_id === null
              ? payload.response_id
              : null,
          authenticated: payload.authenticated,
          role: payload.role,
          reason: payload.reason ?? null,
          type: "authenticate_response",
          request_id:
            typeof payload.request_id === "string" || payload.request_id === null
              ? payload.request_id
              : undefined
        };
      }
      return null;

    case "state_snapshot":
      if (typeof payload.state_version === "number" && isRecord(payload.state)) {
        return {
          response_id:
            typeof payload.response_id === "string" || payload.response_id === null
              ? payload.response_id
              : null,
          state: payload.state as ProtocolBackendState,
          state_version: payload.state_version,
          type: "state_snapshot",
          request_id:
            typeof payload.request_id === "string" || payload.request_id === null
              ? payload.request_id
              : undefined
        };
      }
      return null;

    case "state_patch":
      if (
        typeof payload.state_version === "number" &&
        (payload.ops === null ||
          (Array.isArray(payload.ops) && payload.ops.every(isPatchOperation)))
      ) {
        return {
          response_id:
            typeof payload.response_id === "string" || payload.response_id === null
              ? payload.response_id
              : null,
          ops: payload.ops ?? null,
          state_version: payload.state_version,
          type: "state_patch",
          request_id:
            typeof payload.request_id === "string" || payload.request_id === null
              ? payload.request_id
              : undefined
        };
      }
      return null;

    case "error":
      if (typeof payload.reason === "string") {
        return {
          response_id:
            typeof payload.response_id === "string" || payload.response_id === null
              ? payload.response_id
              : null,
          reason: payload.reason,
          type: "error",
          request_id:
            typeof payload.request_id === "string" || payload.request_id === null
              ? payload.request_id
              : undefined
        };
      }
      return null;

    case "action_executed":
      if (
        typeof payload.sheet_id === "string" &&
        typeof payload.action_id === "string" &&
        Array.isArray(payload.applied_mutations) &&
        payload.applied_mutations.every((value) => typeof value === "string") &&
        Array.isArray(payload.emitted_messages) &&
        payload.emitted_messages.every((value) => typeof value === "string")
      ) {
        return {
          response_id:
            typeof payload.response_id === "string" || payload.response_id === null
              ? payload.response_id
              : null,
          sheet_id: payload.sheet_id,
          action_id: payload.action_id,
          applied_mutations: payload.applied_mutations,
          emitted_messages: payload.emitted_messages,
          type: "action_executed",
          request_id:
            typeof payload.request_id === "string" || payload.request_id === null
              ? payload.request_id
              : undefined
        };
      }
      return null;

    case "sheet_access_claimed":
      if (typeof payload.sheet_id === "string" && typeof payload.instance_id === "string") {
        return {
          response_id:
            typeof payload.response_id === "string" || payload.response_id === null
              ? payload.response_id
              : null,
          sheet_id: payload.sheet_id,
          instance_id: payload.instance_id,
          type: "sheet_access_claimed",
          request_id:
            typeof payload.request_id === "string" || payload.request_id === null
              ? payload.request_id
              : undefined
        };
      }
      return null;

    case "action_formula_authoring_metadata":
      if (
        Array.isArray(payload.variables) &&
        Array.isArray(payload.formula_roots) &&
        Array.isArray(payload.action_mutation_roots) &&
        Array.isArray(payload.formula_aliases) &&
        Array.isArray(payload.action_steps) &&
        Array.isArray(payload.action_preset_templates) &&
        Array.isArray(payload.action_attribute_presets)
      ) {
        return {
          response_id:
            typeof payload.response_id === "string" || payload.response_id === null
              ? payload.response_id
              : null,
          variables: payload.variables as ProtocolActionFormulaAuthoringMetadataEvent["variables"],
          formula_roots:
            payload.formula_roots as ProtocolActionFormulaAuthoringMetadataEvent["formula_roots"],
          action_mutation_roots:
            payload.action_mutation_roots as ProtocolActionFormulaAuthoringMetadataEvent["action_mutation_roots"],
          formula_aliases:
            payload.formula_aliases as ProtocolActionFormulaAuthoringMetadataEvent["formula_aliases"],
          action_steps:
            payload.action_steps as ProtocolActionFormulaAuthoringMetadataEvent["action_steps"],
          action_preset_templates:
            payload.action_preset_templates as ProtocolActionFormulaAuthoringMetadataEvent["action_preset_templates"],
          action_attribute_presets:
            payload.action_attribute_presets as ProtocolActionFormulaAuthoringMetadataEvent["action_attribute_presets"],
          default_sheet_actions: Array.isArray(payload.default_sheet_actions)
            ? (payload.default_sheet_actions as ProtocolActionFormulaAuthoringMetadataEvent["default_sheet_actions"])
            : [],
          attribute_formula_variables: Array.isArray(payload.attribute_formula_variables)
            ? (payload.attribute_formula_variables as ProtocolActionFormulaAuthoringMetadataEvent["attribute_formula_variables"])
            : [],
          sheet_formula_stat_defaults: Array.isArray(payload.sheet_formula_stat_defaults)
            ? (payload.sheet_formula_stat_defaults as ProtocolActionFormulaAuthoringMetadataEvent["sheet_formula_stat_defaults"])
            : [],
          type: "action_formula_authoring_metadata",
          request_id:
            typeof payload.request_id === "string" || payload.request_id === null
              ? payload.request_id
              : undefined
        };
      }
      return null;

    case "augmentation_target_metadata":
      if (
        Array.isArray(payload.targets) &&
        (payload.context === "item_template" ||
          payload.context === "condition_template" ||
          payload.context === "runtime" ||
          payload.context === null ||
          payload.context === undefined)
      ) {
        return {
          response_id:
            typeof payload.response_id === "string" || payload.response_id === null
              ? payload.response_id
              : null,
          targets: payload.targets as ProtocolAugmentationTargetMetadataEvent["targets"],
          context: payload.context ?? null,
          type: "augmentation_target_metadata",
          request_id:
            typeof payload.request_id === "string" || payload.request_id === null
              ? payload.request_id
              : undefined
        };
      }
      return null;

    case "roll20_bridge_status":
      if (typeof payload.connected === "boolean") {
        return {
          response_id:
            typeof payload.response_id === "string" || payload.response_id === null
              ? payload.response_id
              : null,
          connected: payload.connected,
          type: "roll20_bridge_status",
          request_id:
            typeof payload.request_id === "string" || payload.request_id === null
              ? payload.request_id
              : undefined
        };
      }
      return null;

    case "roll20_bridge_sync_config":
      if (typeof payload.service_auth_code === "string" && payload.service_auth_code.length > 0) {
        return {
          response_id:
            typeof payload.response_id === "string" || payload.response_id === null
              ? payload.response_id
              : null,
          service_auth_code: payload.service_auth_code,
          type: "roll20_bridge_sync_config",
          request_id:
            typeof payload.request_id === "string" || payload.request_id === null
              ? payload.request_id
              : undefined
        };
      }
      return null;

    case "xp_tracker":
      if (
        typeof payload.can_manage === "boolean" &&
        Array.isArray(payload.sheets) &&
        Array.isArray(payload.parties) &&
        Array.isArray(payload.kills) &&
        Array.isArray(payload.adjustments) &&
        Array.isArray(payload.mobs)
      ) {
        return {
          response_id:
            typeof payload.response_id === "string" || payload.response_id === null
              ? payload.response_id
              : null,
          can_manage: payload.can_manage,
          sheets: payload.sheets as ProtocolXpTrackerEvent["sheets"],
          parties: payload.parties as ProtocolXpTrackerEvent["parties"],
          kills: payload.kills as ProtocolXpTrackerEvent["kills"],
          adjustments: payload.adjustments as ProtocolXpTrackerEvent["adjustments"],
          mobs: payload.mobs as ProtocolXpTrackerEvent["mobs"],
          type: "xp_tracker",
          request_id:
            typeof payload.request_id === "string" || payload.request_id === null
              ? payload.request_id
              : undefined
        };
      }
      return null;

    case "sheet_access_codes":
      if (
        Array.isArray(payload.codes) &&
        payload.codes.every(
          (entry) =>
            isRecord(entry) &&
            typeof entry.code === "string" &&
            typeof entry.sheet_id === "string" &&
            isNullableString(entry.instance_id) &&
            typeof entry.active === "boolean"
        )
      ) {
        return {
          response_id:
            typeof payload.response_id === "string" || payload.response_id === null
              ? payload.response_id
              : null,
          codes: payload.codes as ProtocolSheetAccessCodesEvent["codes"],
          type: "sheet_access_codes",
          request_id:
            typeof payload.request_id === "string" || payload.request_id === null
              ? payload.request_id
              : undefined
        };
      }
      return null;

    case "state_backup_exported":
      if (
        typeof payload.persisted_state_json === "string" &&
        typeof payload.schema_version === "number"
      ) {
        return {
          response_id:
            typeof payload.response_id === "string" || payload.response_id === null
              ? payload.response_id
              : null,
          persisted_state_json: payload.persisted_state_json,
          schema_version: payload.schema_version,
          type: "state_backup_exported",
          request_id:
            typeof payload.request_id === "string" || payload.request_id === null
              ? payload.request_id
              : undefined
        };
      }
      return null;

    default:
      return null;
  }
}
