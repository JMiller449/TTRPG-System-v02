import type { PatchOp } from "@/domain/ipc";
import type { AppAction, AppState } from "@/app/state/types";
import { removeById, upsert } from "@/app/state/reducer/shared";

function applyPatch(state: AppState, op: PatchOp): AppState {
  switch (op.op) {
    case "upsert_template": {
      const next = upsert(state.templates, state.templateOrder, op.value);
      return { ...state, templates: next.map, templateOrder: next.order };
    }

    case "remove_template": {
      const next = removeById(state.templates, state.templateOrder, op.value.id);
      return { ...state, templates: next.map, templateOrder: next.order };
    }

    case "upsert_instance": {
      const next = upsert(state.instances, state.instanceOrder, op.value);
      return { ...state, instances: next.map, instanceOrder: next.order };
    }

    case "remove_instance": {
      const next = removeById(state.instances, state.instanceOrder, op.value.id);
      const nextActive = state.activeSheetId === op.value.id ? next.order[0] ?? null : state.activeSheetId;
      return {
        ...state,
        instances: next.map,
        instanceOrder: next.order,
        activeSheetId: nextActive
      };
    }

    case "upsert_encounter": {
      const next = upsert(state.encounters, state.encounterOrder, op.value);
      return { ...state, encounters: next.map, encounterOrder: next.order };
    }

    case "remove_encounter": {
      const next = removeById(state.encounters, state.encounterOrder, op.value.id);
      return { ...state, encounters: next.map, encounterOrder: next.order };
    }

    case "set_active_sheet":
      return { ...state, activeSheetId: op.value.sheetId };

    case "add_roll_log":
      return { ...state, rollLog: [op.value, ...state.rollLog] };

    case "update_roll_log":
      return {
        ...state,
        rollLog: state.rollLog.map((entry) => (entry.id === op.value.id ? { ...entry, ...op.value } : entry))
      };

    default:
      return state;
  }
}

export function syncReducer(state: AppState, action: AppAction): AppState | undefined {
  switch (action.type) {
    case "apply_snapshot": {
      const templates = Object.fromEntries(action.snapshot.templates.map((item) => [item.id, item]));
      const instances = Object.fromEntries(action.snapshot.instances.map((item) => [item.id, item]));
      const encounters = Object.fromEntries(action.snapshot.encounters.map((item) => [item.id, item]));
      return {
        ...state,
        templates,
        templateOrder: action.snapshot.templates.map((item) => item.id),
        instances,
        instanceOrder: action.snapshot.instances.map((item) => item.id),
        encounters,
        encounterOrder: action.snapshot.encounters.map((item) => item.id),
        rollLog: action.snapshot.rollLog,
        activeSheetId: action.snapshot.activeSheetId
      };
    }

    case "apply_patch":
      return action.ops.reduce(applyPatch, state);

    case "optimistic_add_roll":
      return { ...state, rollLog: [action.entry, ...state.rollLog] };

    default:
      return undefined;
  }
}
