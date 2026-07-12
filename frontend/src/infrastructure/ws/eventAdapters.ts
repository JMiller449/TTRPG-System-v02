import type { AppSnapshot, ServerEvent } from "@/domain/ipc";
import type { ActiveCondition, EncounterPreset, Role } from "@/domain/models";
import type {
  ProtocolBackendState,
  ProtocolPatchOperation,
  ProtocolServerEvent
} from "@/infrastructure/ws/protocol";
import type {
  ActiveConditionPayload,
  EncounterPresetPayload,
  StandaloneEffectDefinitionPayload
} from "@/generated/backendProtocol";
import type { StandaloneEffectDefinition } from "@/domain/models";

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
  return path.slice(1).split("/").map(decodePointerSegment);
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

function applySinglePatchToDraft(state: ProtocolBackendState, op: ProtocolPatchOperation): void {
  const { container, leaf } = readContainer(state, parsePointer(op.path));

  if (Array.isArray(container)) {
    if (op.op === "remove") {
      container.splice(Number(leaf), 1);
      return;
    }

    if (op.op === "add" && leaf === "-") {
      container.push(op.value);
      return;
    }

    const index = Number(leaf);
    if (!Number.isInteger(index)) {
      throw new Error(`Invalid array index '${leaf}'`);
    }

    if (op.op === "inc") {
      container[index] = Number(container[index]) + Number(op.value ?? 0);
      return;
    }

    if (op.op === "add") {
      container.splice(index, 0, op.value);
      return;
    }

    container[index] = op.value;
    return;
  }

  if (typeof container !== "object" || container === null) {
    throw new Error(`Cannot apply patch to non-container path '${op.path}'`);
  }

  const record = container as Record<string, unknown>;
  if (op.op === "remove") {
    delete record[leaf];
    return;
  }

  if (op.op === "inc") {
    record[leaf] = Number(record[leaf] ?? 0) + Number(op.value ?? 0);
    return;
  }

  record[leaf] = op.value;
}

function applyProtocolPatch(
  state: ProtocolBackendState,
  ops: ProtocolPatchOperation[] | null
): ProtocolBackendState {
  if (!ops || ops.length === 0) {
    return state;
  }
  const nextState = cloneBackendState(state);
  ops.forEach((op) => applySinglePatchToDraft(nextState, op));
  return nextState;
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

function projectEncounterPreset(value: EncounterPresetPayload): EncounterPreset {
  return {
    id: value.id,
    name: value.name,
    entries: (value.entries ?? []).map((entry) => ({
      templateId: entry.template_id,
      count: entry.count
    })),
    updatedAt: value.updated_at
  };
}

function projectActiveCondition(value: ActiveConditionPayload): ActiveCondition {
  return {
    application_id: value.application_id,
    condition_id: value.condition_id,
    condition_name: value.condition_name,
    description: value.description ?? "",
    visibility: value.visibility ?? "public",
    instance_id: value.instance_id,
    augmentation_ids: value.augmentation_ids ?? [],
    source: {
      type: value.source?.type ?? "other",
      id: value.source?.id ?? null,
      label: value.source?.label ?? null
    },
    applied_at: value.applied_at ?? null,
    applied_by_role: value.applied_by_role ?? null,
    applied_at_state_version: value.applied_at_state_version ?? null
  };
}

function projectStandaloneEffect(
  value: StandaloneEffectDefinitionPayload
): StandaloneEffectDefinition {
  return {
    ...value,
    scope: value.scope ?? "instance",
    active: value.active ?? true,
    lifecycle: value.lifecycle ?? {}
  };
}

function projectSnapshot(state: ProtocolBackendState): AppSnapshot {
  return {
    sheets: Object.values(state.sheets ?? {}),
    persistentSheets: Object.entries(state.instanced_sheets ?? {}).map(([id, value]) => ({
      id,
      value
    })),
    items: Object.values(state.items ?? {}),
    proficiencies: Object.values(state.proficiencies ?? {}),
    actions: Object.values(state.actions ?? {}),
    formulas: Object.values(state.formulas ?? {}),
    attributes: Object.values(state.attributes ?? {}),
    augmentations: Object.values(state.augmentations ?? {}),
    standaloneEffects: Object.values(state.standalone_effects ?? {}).map(projectStandaloneEffect),
    standaloneEffectApplications: Object.values(state.standalone_effect_applications ?? {}),
    conditionPresets: Object.values(state.condition_presets ?? {}),
    activeConditions: Object.values(state.active_conditions ?? {}).map(projectActiveCondition),
    encounters: Object.values(state.encounter_presets ?? {}).map(projectEncounterPreset),
    actionHistory: Object.values(state.action_history ?? {})
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
            incremental: false,
            requestId: event.request_id ?? undefined
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
            incremental: true,
            requestId: event.request_id ?? undefined
          }
        ]
      };
    }

    case "action_executed":
      return {
        nextProtocolState: protocolState,
        events: event.request_id ? [{ type: "ack", requestId: event.request_id }] : []
      };

    case "sheet_access_claimed":
      return {
        nextProtocolState: protocolState,
        events: [
          {
            type: "sheet_access_claimed",
            sheetId: event.sheet_id,
            instanceId: event.instance_id,
            requestId: event.request_id ?? undefined
          }
        ]
      };

    case "action_formula_authoring_metadata":
      return {
        nextProtocolState: protocolState,
        events: [
          {
            type: "action_formula_authoring_metadata",
            metadata: {
              variables: event.variables,
              formula_roots: event.formula_roots,
              action_mutation_roots: event.action_mutation_roots,
              formula_aliases: event.formula_aliases,
              action_steps: event.action_steps,
              action_preset_templates: event.action_preset_templates,
              action_attribute_presets: event.action_attribute_presets,
              default_sheet_actions: event.default_sheet_actions ?? [],
              attribute_formula_variables: event.attribute_formula_variables ?? [],
              sheet_formula_stat_defaults: event.sheet_formula_stat_defaults ?? []
            },
            requestId: event.request_id ?? undefined
          }
        ]
      };

    case "augmentation_target_metadata":
      return {
        nextProtocolState: protocolState,
        events: [
          {
            type: "augmentation_target_metadata",
            metadata: {
              targets: event.targets,
              context: event.context
            },
            requestId: event.request_id ?? undefined
          }
        ]
      };

    case "xp_tracker":
      return {
        nextProtocolState: protocolState,
        events: [
          {
            type: "xp_tracker",
            tracker: {
              can_manage: event.can_manage,
              sheets: event.sheets,
              parties: event.parties,
              kills: event.kills,
              adjustments: event.adjustments,
              mobs: event.mobs
            },
            requestId: event.request_id ?? undefined
          }
        ]
      };

    case "roll20_bridge_status":
      return {
        nextProtocolState: protocolState,
        events: [
          {
            type: "roll20_bridge_status",
            connected: event.connected,
            requestId: event.request_id ?? undefined
          }
        ]
      };

    case "roll20_bridge_sync_config":
      return {
        nextProtocolState: protocolState,
        events: [
          {
            type: "roll20_bridge_sync_config",
            serviceAuthCode: event.service_auth_code,
            requestId: event.request_id ?? undefined
          }
        ]
      };

    case "sheet_access_codes":
      return {
        nextProtocolState: protocolState,
        events: [
          {
            type: "sheet_access_codes",
            codes: event.codes.map((entry) => ({
              code: entry.code,
              sheetId: entry.sheet_id,
              instanceId: entry.instance_id ?? null,
              active: entry.active ?? true
            })),
            requestId: event.request_id ?? undefined
          }
        ]
      };

    case "state_backup_exported":
      return {
        nextProtocolState: protocolState,
        events: [
          {
            type: "state_backup_exported",
            backup: {
              persisted_state_json: event.persisted_state_json,
              schema_version: event.schema_version
            },
            requestId: event.request_id ?? undefined
          }
        ]
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

    case "variable_registry":
      return {
        nextProtocolState: protocolState,
        events: []
      };
  }
}
