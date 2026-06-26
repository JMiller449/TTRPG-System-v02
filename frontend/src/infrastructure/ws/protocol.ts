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
  SheetAccessCodesEvent as ProtocolSheetAccessCodesEvent,
  StateBackupExportedEvent as ProtocolStateBackupExportedEvent,
  StatePatchEvent as ProtocolStatePatchEvent,
  StateSnapshotEvent as ProtocolStateSnapshotEvent
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
  ProtocolSheetAccessCodesEvent,
  ProtocolServerEvent,
  ProtocolStateBackupExportedEvent,
  ProtocolStatePatchEvent,
  ProtocolStateSnapshotEvent
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
        (payload.role === "player" || payload.role === "dm" || payload.role === "service" || payload.role === null) &&
        isNullableString(payload.reason)
      ) {
        return {
          response_id: typeof payload.response_id === "string" || payload.response_id === null ? payload.response_id : null,
          authenticated: payload.authenticated,
          role: payload.role,
          reason: payload.reason ?? null,
          type: "authenticate_response",
          request_id: typeof payload.request_id === "string" || payload.request_id === null ? payload.request_id : undefined
        };
      }
      return null;

    case "state_snapshot":
      if (typeof payload.state_version === "number" && isRecord(payload.state)) {
        return {
          response_id: typeof payload.response_id === "string" || payload.response_id === null ? payload.response_id : null,
          state: payload.state as ProtocolBackendState,
          state_version: payload.state_version,
          type: "state_snapshot",
          request_id: typeof payload.request_id === "string" || payload.request_id === null ? payload.request_id : undefined
        };
      }
      return null;

    case "state_patch":
      if (
        typeof payload.state_version === "number" &&
        (payload.ops === null || (Array.isArray(payload.ops) && payload.ops.every(isPatchOperation)))
      ) {
        return {
          response_id: typeof payload.response_id === "string" || payload.response_id === null ? payload.response_id : null,
          ops: payload.ops ?? null,
          state_version: payload.state_version,
          type: "state_patch",
          request_id: typeof payload.request_id === "string" || payload.request_id === null ? payload.request_id : undefined
        };
      }
      return null;

    case "error":
      if (typeof payload.reason === "string") {
        return {
          response_id: typeof payload.response_id === "string" || payload.response_id === null ? payload.response_id : null,
          reason: payload.reason,
          type: "error",
          request_id: typeof payload.request_id === "string" || payload.request_id === null ? payload.request_id : undefined
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
          response_id: typeof payload.response_id === "string" || payload.response_id === null ? payload.response_id : null,
          sheet_id: payload.sheet_id,
          action_id: payload.action_id,
          applied_mutations: payload.applied_mutations,
          emitted_messages: payload.emitted_messages,
          type: "action_executed",
          request_id: typeof payload.request_id === "string" || payload.request_id === null ? payload.request_id : undefined
        };
      }
      return null;

    case "sheet_access_claimed":
      if (typeof payload.sheet_id === "string" && typeof payload.instance_id === "string") {
        return {
          response_id: typeof payload.response_id === "string" || payload.response_id === null ? payload.response_id : null,
          sheet_id: payload.sheet_id,
          instance_id: payload.instance_id,
          type: "sheet_access_claimed",
          request_id: typeof payload.request_id === "string" || payload.request_id === null ? payload.request_id : undefined
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
        Array.isArray(payload.action_preset_templates)
      ) {
        return {
          response_id: typeof payload.response_id === "string" || payload.response_id === null ? payload.response_id : null,
          variables: payload.variables as ProtocolActionFormulaAuthoringMetadataEvent["variables"],
          formula_roots: payload.formula_roots as ProtocolActionFormulaAuthoringMetadataEvent["formula_roots"],
          action_mutation_roots: payload.action_mutation_roots as ProtocolActionFormulaAuthoringMetadataEvent["action_mutation_roots"],
          formula_aliases: payload.formula_aliases as ProtocolActionFormulaAuthoringMetadataEvent["formula_aliases"],
          action_steps: payload.action_steps as ProtocolActionFormulaAuthoringMetadataEvent["action_steps"],
          action_preset_templates: payload.action_preset_templates as ProtocolActionFormulaAuthoringMetadataEvent["action_preset_templates"],
          type: "action_formula_authoring_metadata",
          request_id: typeof payload.request_id === "string" || payload.request_id === null ? payload.request_id : undefined
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
          response_id: typeof payload.response_id === "string" || payload.response_id === null ? payload.response_id : null,
          targets: payload.targets as ProtocolAugmentationTargetMetadataEvent["targets"],
          context: payload.context ?? null,
          type: "augmentation_target_metadata",
          request_id: typeof payload.request_id === "string" || payload.request_id === null ? payload.request_id : undefined
        };
      }
      return null;

    case "roll20_bridge_status":
      if (typeof payload.connected === "boolean") {
        return {
          response_id: typeof payload.response_id === "string" || payload.response_id === null ? payload.response_id : null,
          connected: payload.connected,
          type: "roll20_bridge_status",
          request_id: typeof payload.request_id === "string" || payload.request_id === null ? payload.request_id : undefined
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
