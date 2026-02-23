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
        gmView: action.role === "gm" ? state.gmView : "console"
      };
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
    case "upsert_item_template": {
      const exists = state.itemTemplateOrder.includes(action.item.id);
      return {
        ...state,
        itemTemplates: {
          ...state.itemTemplates,
          [action.item.id]: action.item
        },
        itemTemplateOrder: exists ? state.itemTemplateOrder : [...state.itemTemplateOrder, action.item.id]
      };
    }
    case "remove_item_template": {
      const nextTemplates = { ...state.itemTemplates };
      delete nextTemplates[action.itemId];
      const nextEquipment = Object.fromEntries(
        Object.entries(state.localSheetEquipment).map(([sheetId, entries]) => [
          sheetId,
          entries.filter((entry) => entry.itemTemplateId !== action.itemId)
        ])
      );
      const nextActiveWeapon = Object.fromEntries(
        Object.entries(state.localSheetActiveWeapon).map(([sheetId, activeInventoryId]) => {
          if (!activeInventoryId) {
            return [sheetId, null];
          }
          const stillExists = (nextEquipment[sheetId] ?? []).some((entry) => entry.id === activeInventoryId);
          return [sheetId, stillExists ? activeInventoryId : null];
        })
      );
      return {
        ...state,
        itemTemplates: nextTemplates,
        itemTemplateOrder: state.itemTemplateOrder.filter((id) => id !== action.itemId),
        localSheetEquipment: nextEquipment,
        localSheetActiveWeapon: nextActiveWeapon
      };
    }
    case "add_sheet_equipment": {
      const current = state.localSheetEquipment[action.sheetId] ?? [];
      return {
        ...state,
        localSheetEquipment: {
          ...state.localSheetEquipment,
          [action.sheetId]: [...current, action.entry]
        }
      };
    }
    case "remove_sheet_equipment": {
      const current = state.localSheetEquipment[action.sheetId] ?? [];
      const nextItems = current.filter((entry) => entry.id !== action.inventoryItemId);
      const currentActive = state.localSheetActiveWeapon[action.sheetId] ?? null;
      return {
        ...state,
        localSheetEquipment: {
          ...state.localSheetEquipment,
          [action.sheetId]: nextItems
        },
        localSheetActiveWeapon: {
          ...state.localSheetActiveWeapon,
          [action.sheetId]: currentActive === action.inventoryItemId ? null : currentActive
        }
      };
    }
    case "set_sheet_active_weapon":
      return {
        ...state,
        localSheetActiveWeapon: {
          ...state.localSheetActiveWeapon,
          [action.sheetId]: action.inventoryItemId
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
