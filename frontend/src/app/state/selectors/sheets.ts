import type { AppState } from "@/app/state/types";
import type {
  ActionDefinition,
  ActionStep,
  ActiveCondition,
  Bridge,
  ItemBridge,
  ItemDefinition,
  PersistentSheet,
  ProficiencyBridge,
  Sheet,
  SheetInstanceView,
  SheetKind,
  StandaloneEffectApplication,
  StandaloneEffectDefinition,
  SheetTemplateView
} from "@/domain/models";
import type { SheetStatKey } from "@/domain/stats";

export interface ActiveSheetDetail {
  instance: SheetInstanceView;
  sheet: Sheet | null;
  persistentSheet: PersistentSheet;
  baseStats: Partial<Record<SheetStatKey, number>>;
  stats: Partial<Record<SheetStatKey, number>>;
  resources: { health: number; mana: number };
  resourceMaximums: { health: number; mana: number };
  reactions: { current: number; maximum: number };
  contributionPoints: number;
}

export interface AssignedSheetAction {
  relationshipId: string;
  actionId: string;
  action: ActionDefinition;
  bridge?: Bridge;
  sourceItemRelationshipId?: string;
  sourceItemName?: string;
  sourceItemAvailability?: "carried" | "equipped";
  consumeQuantity?: number;
}

export interface ActiveStandaloneEffect {
  application: StandaloneEffectApplication;
  definition: StandaloneEffectDefinition;
  sourceAction: ActionDefinition | null;
  sourceStep: ActionStep | null;
}

const WEAPON_ACTION_IDS = new Set([
  "weapon_attack",
  "weapon_damage",
  "weapon_parry",
  "weapon_contest"
]);

function getSheetKind(sheet: Sheet | null): SheetKind {
  if (!sheet) {
    return "player";
  }
  return sheet.dm_only ? "enemy" : "player";
}

function buildBaseStatValues(
  sheet: Sheet | null,
  persistentSheet?: PersistentSheet | null
): Partial<Record<SheetStatKey, number>> {
  if (!sheet) {
    return {};
  }

  const runtimeStats = persistentSheet?.stats ?? sheet.stats;
  const evaluatedStats = persistentSheet?.evaluated_stats ?? sheet.evaluated_stats ?? {};
  return {
    strength: runtimeStats.strength,
    dexterity: runtimeStats.dexterity,
    constitution: runtimeStats.constitution,
    perception: runtimeStats.perception,
    arcane: runtimeStats.arcane,
    will: runtimeStats.will,
    ...evaluatedStats
  };
}

export function selectSheetTemplateView(
  state: AppState,
  sheetId: string
): SheetTemplateView | null {
  const { serverState } = state;
  const sheet = serverState.sheets[sheetId];
  if (!sheet) {
    return null;
  }

  return {
    id: sheet.id,
    sheet,
    kind: getSheetKind(sheet),
    name: sheet.name,
    notes: sheet.notes ?? "",
    stats: buildBaseStatValues(sheet)
  };
}

export function selectSheetTemplateViews(state: AppState): SheetTemplateView[] {
  return state.serverState.sheetOrder
    .map((id) => selectSheetTemplateView(state, id))
    .filter((entry): entry is SheetTemplateView => Boolean(entry));
}

export function selectSheetInstanceView(
  state: AppState,
  persistentSheetId: string
): SheetInstanceView | null {
  const { serverState } = state;
  const persistentSheet = serverState.persistentSheets[persistentSheetId];
  if (!persistentSheet) {
    return null;
  }

  const sheet = serverState.sheets[persistentSheet.parent_id] ?? null;

  return {
    id: persistentSheetId,
    persistentSheet,
    parentSheet: sheet,
    kind: getSheetKind(sheet),
    name: sheet?.name ?? persistentSheetId,
    notes: persistentSheet.notes ?? sheet?.notes ?? ""
  };
}

export function selectActiveSheetDetail(state: AppState): ActiveSheetDetail | null {
  const { uiState } = state;
  if (!uiState.activeSheetId) {
    return null;
  }

  const instance = selectSheetInstanceView(state, uiState.activeSheetId);
  if (!instance) {
    return null;
  }

  const baseStats = buildBaseStatValues(instance.parentSheet, instance.persistentSheet);
  return {
    instance,
    sheet: instance.parentSheet,
    persistentSheet: instance.persistentSheet,
    baseStats,
    stats: baseStats,
    resources: {
      health: instance.persistentSheet.health,
      mana: instance.persistentSheet.mana
    },
    resourceMaximums: {
      health:
        instance.persistentSheet.evaluated_max_health ??
        instance.parentSheet?.evaluated_max_health ??
        0,
      mana:
        instance.persistentSheet.evaluated_max_mana ?? instance.parentSheet?.evaluated_max_mana ?? 0
    },
    reactions: {
      current: instance.persistentSheet.reactions ?? 0,
      maximum: instance.persistentSheet.evaluated_max_reactions ?? 0
    },
    contributionPoints: instance.persistentSheet.contribution_points ?? 0
  };
}

function resolveSheetFromSheetOrInstanceId(
  state: AppState,
  sheetOrInstanceId: string
): Sheet | null {
  const directSheet = state.serverState.sheets[sheetOrInstanceId];
  if (directSheet) {
    return directSheet;
  }

  const instance = state.serverState.persistentSheets[sheetOrInstanceId];
  return instance ? (state.serverState.sheets[instance.parent_id] ?? null) : null;
}

export function selectSheetEquipment(state: AppState, sheetOrInstanceId: string): ItemBridge[] {
  const instance = state.serverState.persistentSheets[sheetOrInstanceId];
  if (instance) {
    return Object.values(instance.items ?? {});
  }
  const sheet = resolveSheetFromSheetOrInstanceId(state, sheetOrInstanceId);
  return Object.values(sheet?.items ?? {});
}

export function selectActiveConditions(state: AppState, instanceId: string): ActiveCondition[] {
  return state.serverState.activeConditionOrder
    .map((applicationId) => state.serverState.activeConditions[applicationId])
    .filter((condition): condition is ActiveCondition => Boolean(condition))
    .filter((condition) => condition.instance_id === instanceId);
}

export function selectActiveStandaloneEffects(
  state: AppState,
  instanceId: string
): ActiveStandaloneEffect[] {
  return state.serverState.standaloneEffectApplicationOrder.flatMap((applicationId) => {
    const application = state.serverState.standaloneEffectApplications[applicationId];
    if (!application || application.instance_id !== instanceId || application.active === false) {
      return [];
    }

    const definition = state.serverState.standaloneEffects[application.definition_id];
    if (!definition) {
      return [];
    }

    const sourceAction = application.source.id
      ? (state.serverState.actions[application.source.id] ?? null)
      : null;
    const sourceStep = application.source.relationship_id
      ? ((sourceAction?.steps ?? []).find(
          (step) => step.step_id === application.source.relationship_id
        ) ?? null)
      : null;

    return [{ application, definition, sourceAction, sourceStep }];
  });
}

export function selectSheetProficiencies(
  state: AppState,
  sheetOrInstanceId: string
): ProficiencyBridge[] {
  const instance = state.serverState.persistentSheets[sheetOrInstanceId];
  if (instance) {
    const sheet = resolveSheetFromSheetOrInstanceId(state, sheetOrInstanceId);
    return Object.values(instance.proficiencies ?? sheet?.proficiencies ?? {});
  }
  const sheet = resolveSheetFromSheetOrInstanceId(state, sheetOrInstanceId);
  return Object.values(sheet?.proficiencies ?? {});
}

export function selectAvailableItems(state: AppState): ItemDefinition[] {
  return state.serverState.itemOrder
    .map((id) => state.serverState.items[id])
    .filter((entry): entry is ItemDefinition => Boolean(entry));
}

export function selectSheetAssignedActions(
  state: AppState,
  sheetOrInstanceId: string
): AssignedSheetAction[] {
  const instance = state.serverState.persistentSheets[sheetOrInstanceId];
  const sheet = resolveSheetFromSheetOrInstanceId(state, sheetOrInstanceId);
  const actionBridges = instance ? (instance.actions ?? sheet?.actions) : sheet?.actions;
  if (!actionBridges || !sheet) {
    return [];
  }

  const assignedActions = Object.values(actionBridges)
    .map((bridge): AssignedSheetAction | null => {
      if (WEAPON_ACTION_IDS.has(bridge.entry_id)) {
        return null;
      }
      const action = state.serverState.actions[bridge.entry_id];
      if (!action) {
        return null;
      }

      return {
        relationshipId: bridge.relationship_id,
        actionId: action.id,
        action,
        bridge
      };
    })
    .filter((entry): entry is AssignedSheetAction => Boolean(entry));

  const inventory = instance?.items ?? sheet.items ?? {};
  const itemGrantedActions = Object.values(inventory).flatMap((itemBridge) => {
    if (itemBridge.count <= 0) {
      return [];
    }
    const item = state.serverState.items[itemBridge.item_id];
    if (!item || item.interaction_type === "inventory_only") {
      return [];
    }
    return (item.action_grants ?? []).flatMap((grant) => {
      if (grant.availability === "equipped" && !itemBridge.equipped) {
        return [];
      }
      if (grant.availability === "equipped" && item.interaction_type !== "equippable") {
        return [];
      }
      if ((grant.consume_quantity ?? 0) > itemBridge.count) {
        return [];
      }
      const action = state.serverState.actions[grant.action_id];
      if (!action) {
        return [];
      }
      return [
        {
          relationshipId: `item:${itemBridge.relationship_id}:${grant.action_id}`,
          actionId: action.id,
          action,
          sourceItemRelationshipId: itemBridge.relationship_id,
          sourceItemName: item.name,
          sourceItemAvailability: grant.availability,
          consumeQuantity: grant.consume_quantity ?? 0
        }
      ];
    });
  });

  return [...assignedActions, ...itemGrantedActions];
}

export function selectPlayerInstances(state: AppState): SheetInstanceView[] {
  return state.serverState.persistentSheetOrder
    .map((id) => selectSheetInstanceView(state, id))
    .filter((entry): entry is SheetInstanceView => Boolean(entry))
    .filter((entry) => entry.kind === "player");
}
