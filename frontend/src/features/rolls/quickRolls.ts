import type { ActionDefinition, ItemDefinition, Sheet } from "@/domain/models";
import {
  buildPerformActionRequest,
  type ActionRollMode
} from "@/infrastructure/ws/requestBuilders";

export type QuickRollAction = "weapon_attack" | "dodge" | "weapon_parry" | "block";

export const QUICK_ROLL_ACTIONS: readonly QuickRollAction[] = [
  "weapon_attack",
  "dodge",
  "weapon_parry",
  "block"
];

const QUICK_ROLL_LABELS: Record<QuickRollAction, string> = {
  weapon_attack: "Weapon Attack",
  dodge: "Dodge",
  weapon_parry: "Weapon Parry",
  block: "Block"
};

const SOURCE_ITEM_QUICK_ROLL_ACTIONS = new Set<QuickRollAction>([
  "weapon_attack",
  "weapon_parry"
]);

export interface ResolvedQuickRollAction {
  action: QuickRollAction;
  actionId: string;
  actionName: string;
  relationshipId: string;
  sourceItemRelationshipId?: string;
}

export interface QuickRollExecutionRequest {
  request: ReturnType<typeof buildPerformActionRequest>;
  label: string;
}

export function getQuickRollRelationshipId(action: QuickRollAction): string {
  return `default_${action}`;
}

export function resolveQuickRollAction(
  sheet: Sheet | null | undefined,
  actions: Record<string, ActionDefinition>,
  action: QuickRollAction,
  items: Record<string, ItemDefinition> = {}
): ResolvedQuickRollAction | null {
  if (!sheet) {
    return null;
  }

  const itemSources = Object.values(sheet.items).flatMap((itemBridge) => {
    if (itemBridge.count <= 0) {
      return [];
    }
    const item = items[itemBridge.item_id];
    const grant = item?.action_grants?.find((entry) => entry.action_id === action);
    if (
      item?.interaction_type === "inventory_only" ||
      !grant ||
      (grant.availability === "equipped" && item?.interaction_type !== "equippable") ||
      (grant.availability === "equipped" && !itemBridge.equipped) ||
      (grant.consume_quantity ?? 0) > itemBridge.count
    ) {
      return [];
    }
    return [itemBridge];
  });
  const actionDefinition = actions[action];
  if (itemSources.length === 1 && actionDefinition) {
    const itemSource = itemSources[0];
    return {
      action,
      actionId: actionDefinition.id,
      actionName: actionDefinition.name,
      relationshipId: `item:${itemSource.relationship_id}:${action}`,
      sourceItemRelationshipId: itemSource.relationship_id
    };
  }
  if (SOURCE_ITEM_QUICK_ROLL_ACTIONS.has(action)) {
    return null;
  }

  const relationshipId = getQuickRollRelationshipId(action);
  const bridge =
    sheet.actions[relationshipId] ??
    Object.values(sheet.actions).find((entry) => entry.entry_id === action);
  if (!bridge) {
    return null;
  }
  const directActionDefinition = actions[bridge.entry_id];
  if (!directActionDefinition) {
    return null;
  }
  return {
    action,
    actionId: directActionDefinition.id,
    actionName: directActionDefinition.name,
    relationshipId: bridge.relationship_id
  };
}

export function getQuickRollLabel(action: QuickRollAction): string {
  return QUICK_ROLL_LABELS[action];
}

export function buildQuickRollExecutionRequest({
  sheetId,
  resolution,
  rollMode
}: {
  sheetId: string;
  resolution: ResolvedQuickRollAction;
  rollMode: ActionRollMode;
}): QuickRollExecutionRequest {
  return {
    request: buildPerformActionRequest({
      sheetId,
      actionId: resolution.actionId,
      sourceItemRelationshipId: resolution.sourceItemRelationshipId,
      rollMode
    }),
    label: `Perform action: ${resolution.actionName}${
      rollMode === "normal" ? "" : ` (${rollMode})`
    }`
  };
}
