import type { AppSnapshot, ServerEvent } from "@/domain/ipc";
import type { Role } from "@/domain/models";
import type {
  ProtocolBackendState,
  ProtocolPatchOperation,
  ProtocolServerEvent
} from "@/infrastructure/ws/protocol";

export interface SocketProtocolState {
  backendState: ProtocolBackendState | null;
}

export const initialSocketProtocolState: SocketProtocolState = {
  backendState: null
};

function decodePointerSegment(segment: string): string {
  return segment.replace(/~1/g, "/").replace(/~0/g, "~");
}

function parsePointer(path: string): string[] {
  if (!path.startsWith("/")) {
    throw new Error(`Invalid patch path: ${path}`);
  }
  if (path === "/") {
    return [];
  }
  return path
    .slice(1)
    .split("/")
    .map(decodePointerSegment);
}

function readContainer(root: unknown, segments: string[]): { container: unknown; leaf: string } {
  if (segments.length === 0) {
    throw new Error("Root-level mutations are not supported");
  }

  let current: unknown = root;
  for (const segment of segments.slice(0, -1)) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        throw new Error(`Invalid array index '${segment}'`);
      }
      current = current[index];
      continue;
    }

    if (typeof current === "object" && current !== null) {
      current = (current as Record<string, unknown>)[segment];
      continue;
    }

    throw new Error(`Cannot traverse patch path segment '${segment}'`);
  }

  return { container: current, leaf: segments[segments.length - 1] ?? "" };
}

function cloneBackendState(state: ProtocolBackendState): ProtocolBackendState {
  return structuredClone(state);
}

function applySinglePatch(state: ProtocolBackendState, op: ProtocolPatchOperation): ProtocolBackendState {
  const nextState = cloneBackendState(state);
  const { container, leaf } = readContainer(nextState, parsePointer(op.path));

  if (Array.isArray(container)) {
    if (op.op === "remove") {
      container.splice(Number(leaf), 1);
      return nextState;
    }

    if (op.op === "add" && leaf === "-") {
      container.push(op.value);
      return nextState;
    }

    const index = Number(leaf);
    if (!Number.isInteger(index)) {
      throw new Error(`Invalid array index '${leaf}'`);
    }

    if (op.op === "inc") {
      container[index] = Number(container[index]) + Number(op.value ?? 0);
      return nextState;
    }

    if (op.op === "add") {
      container.splice(index, 0, op.value);
      return nextState;
    }

    container[index] = op.value;
    return nextState;
  }

  if (typeof container !== "object" || container === null) {
    throw new Error(`Cannot apply patch to non-container path '${op.path}'`);
  }

  const record = container as Record<string, unknown>;
  if (op.op === "remove") {
    delete record[leaf];
    return nextState;
  }

  if (op.op === "inc") {
    record[leaf] = Number(record[leaf] ?? 0) + Number(op.value ?? 0);
    return nextState;
  }

  record[leaf] = op.value;
  return nextState;
}

function applyProtocolPatch(state: ProtocolBackendState, ops: ProtocolPatchOperation[] | null): ProtocolBackendState {
  if (!ops || ops.length === 0) {
    return state;
  }
  return ops.reduce(applySinglePatch, state);
}

function mapRole(role: "player" | "dm" | "service" | null): Role | null {
  if (role === "player") {
    return "player";
  }
  if (role === "dm") {
    return "gm";
  }
  return null;
}

function projectSnapshot(state: ProtocolBackendState): AppSnapshot {
  return {
    sheets: Object.values(state.sheets ?? {}),
    persistentSheets: Object.entries(state.instanced_sheets ?? {}).map(([id, value]) => ({ id, value })),
    sheetPresentation: [],
    persistentSheetPresentation: [],
    encounters: [],
    rollLog: [],
    activeSheetId: null
  };
}

export function adaptProtocolServerEvent(
  protocolState: SocketProtocolState,
  event: ProtocolServerEvent
): { nextProtocolState: SocketProtocolState; events: ServerEvent[] } {
  switch (event.type) {
    case "authenticate_response":
      return {
        nextProtocolState: protocolState,
        events: [
          {
            type: "authenticated",
            authenticated: event.authenticated,
            role: mapRole(event.role),
            requestId: event.request_id ?? undefined,
            reason: event.reason ?? undefined
          }
        ]
      };

    case "state_snapshot": {
      const backendState = cloneBackendState(event.state);
      return {
        nextProtocolState: { backendState },
        events: [
          {
            type: "snapshot",
            snapshot: projectSnapshot(backendState),
            stateVersion: event.state_version,
            incremental: false
          }
        ]
      };
    }

    case "state_patch": {
      if (!protocolState.backendState) {
        return {
          nextProtocolState: protocolState,
          events: [
            {
              type: "error",
              requestId: event.request_id ?? undefined,
              message: "Received state patch before initial snapshot"
            }
          ]
        };
      }

      const backendState = applyProtocolPatch(protocolState.backendState, event.ops ?? null);
      return {
        nextProtocolState: { backendState },
        events: [
          {
            type: "snapshot",
            snapshot: projectSnapshot(backendState),
            stateVersion: event.state_version,
            incremental: true
          }
        ]
      };
    }

    case "action_executed":
      return {
        nextProtocolState: protocolState,
        events: event.request_id ? [{ type: "ack", requestId: event.request_id }] : []
      };

    case "error":
      return {
        nextProtocolState: protocolState,
        events: [
          {
            type: "error",
            requestId: event.request_id ?? undefined,
            message: event.reason
          }
        ]
      };
  }
}
