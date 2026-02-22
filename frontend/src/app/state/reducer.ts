import type { PatchOp } from "@/domain/ipc";
import type { AppAction, AppState } from "@/app/state/types";

const MAX_INTENT_FEEDBACK_ITEMS = 6;

function pushIntentFeedback(state: AppState, action: AppAction): AppState {
  if (action.type !== "push_intent_feedback") {
    return state;
  }

  const trimmed =
    action.item.status === "pending" || !action.item.intentId
      ? state.intentFeedback
      : state.intentFeedback.filter(
          (item) => !(item.intentId === action.item.intentId && item.status === "pending")
        );

  return {
    ...state,
    intentFeedback: [action.item, ...trimmed].slice(0, MAX_INTENT_FEEDBACK_ITEMS)
  };
}

function upsert<T extends { id: string }>(
  map: Record<string, T>,
  order: string[],
  value: T
): { map: Record<string, T>; order: string[] } {
  const nextMap = { ...map, [value.id]: value };
  const exists = order.includes(value.id);
  return {
    map: nextMap,
    order: exists ? order : [...order, value.id]
  };
}

function removeById<T>(
  map: Record<string, T>,
  order: string[],
  id: string
): { map: Record<string, T>; order: string[] } {
  const nextMap = { ...map };
  delete nextMap[id];
  return {
    map: nextMap,
    order: order.filter((entryId) => entryId !== id)
  };
}

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
      const nextActive =
        state.activeSheetId === op.value.id ? next.order[0] ?? null : state.activeSheetId;
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
    case "update_roll_log": {
      return {
        ...state,
        rollLog: state.rollLog.map((entry) =>
          entry.id === op.value.id ? { ...entry, ...op.value } : entry
        )
      };
    }
    default:
      return state;
  }
}

export function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "set_role":
      return {
        ...state,
        role: action.role,
        playerConsoleEnteredSheetId: null,
        gmView: action.role === "gm" ? state.gmView : "console"
      };
    case "set_player_console_entered_sheet":
      return { ...state, playerConsoleEnteredSheetId: action.sheetId };
    case "set_gm_password":
      return { ...state, gmPassword: action.password };
    case "set_gm_authenticated":
      return { ...state, gmAuthenticated: action.value };
    case "set_gm_view":
      return { ...state, gmView: action.view };
    case "set_template_search":
      return { ...state, templateSearch: action.value };
    case "connection_status":
      return { ...state, connection: { ...state.connection, status: action.status } };
    case "connection_error":
      return { ...state, connection: { ...state.connection, error: action.error } };
    case "queue_intent":
      return state.pendingIntentIds.includes(action.intentId)
        ? state
        : { ...state, pendingIntentIds: [...state.pendingIntentIds, action.intentId] };
    case "clear_intent":
      return {
        ...state,
        pendingIntentIds: state.pendingIntentIds.filter((intentId) => intentId !== action.intentId)
      };
    case "push_intent_feedback":
      return pushIntentFeedback(state, action);
    case "dismiss_intent_feedback":
      return {
        ...state,
        intentFeedback: state.intentFeedback.filter((item) => item.id !== action.id)
      };
    case "set_sheet_note":
      return {
        ...state,
        localSheetNotes: {
          ...state.localSheetNotes,
          [action.sheetId]: action.note
        }
      };
    case "add_sheet_equipment": {
      const current = state.localSheetEquipment[action.sheetId] ?? [];
      return {
        ...state,
        localSheetEquipment: {
          ...state.localSheetEquipment,
          [action.sheetId]: [...current, action.item]
        }
      };
    }
    case "remove_sheet_equipment": {
      const current = state.localSheetEquipment[action.sheetId] ?? [];
      const nextItems = current.filter((_, index) => index !== action.index);
      const currentActive = state.localSheetActiveWeapon[action.sheetId] ?? null;
      const removedItem = current[action.index];
      return {
        ...state,
        localSheetEquipment: {
          ...state.localSheetEquipment,
          [action.sheetId]: nextItems
        },
        localSheetActiveWeapon: {
          ...state.localSheetActiveWeapon,
          [action.sheetId]: currentActive === removedItem ? null : currentActive
        }
      };
    }
    case "set_sheet_active_weapon":
      return {
        ...state,
        localSheetActiveWeapon: {
          ...state.localSheetActiveWeapon,
          [action.sheetId]: action.item
        }
      };
    case "set_sheet_stat_overrides": {
      const sanitized = Object.fromEntries(
        Object.entries(action.overrides).filter((entry) => Number.isFinite(entry[1]))
      );
      return {
        ...state,
        localSheetStatOverrides: {
          ...state.localSheetStatOverrides,
          [action.sheetId]: sanitized
        }
      };
    }
    case "clear_sheet_stat_overrides": {
      const next = { ...state.localSheetStatOverrides };
      delete next[action.sheetId];
      return {
        ...state,
        localSheetStatOverrides: next
      };
    }
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
      return state;
  }
}
