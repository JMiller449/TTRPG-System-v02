import type {
  ActionExecutedEvent as ProtocolActionExecutedEvent,
  AuthenticateResponseEvent as ProtocolAuthenticateResponseEvent,
  BackendStateSnapshotPayload as ProtocolBackendState,
  ErrorEvent as ProtocolErrorEvent,
  PatchOperation as ProtocolPatchOperation,
  ProtocolApplicationRequest,
  ProtocolServerEvent,
  StatePatchEvent as ProtocolStatePatchEvent,
  StateSnapshotEvent as ProtocolStateSnapshotEvent
} from "@/generated/backendProtocol";

export type {
  ProtocolActionExecutedEvent,
  ProtocolApplicationRequest,
  ProtocolAuthenticateResponseEvent,
  ProtocolBackendState,
  ProtocolErrorEvent,
  ProtocolPatchOperation,
  ProtocolServerEvent,
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

    default:
      return null;
  }
}
