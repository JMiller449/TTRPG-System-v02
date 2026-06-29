import type { ActionDefinition, ItemDefinition, Sheet } from "@/domain/models";
import {
  buildPerformActionRequest,
  type ActionRollMode
} from "@/infrastructure/ws/requestBuilders";

export type QuickRollAction = "attack" | "dodge" | "parry" | "block";

export const QUICK_ROLL_ACTIONS: readonly QuickRollAction[] = ["attack", "dodge", "parry", "block"];

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

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
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

  const relationshipId = getQuickRollRelationshipId(action);
  const bridge =
    sheet.actions[relationshipId] ??
    Object.values(sheet.actions).find((entry) => entry.entry_id === action);
  if (bridge) {
    const actionDefinition = actions[bridge.entry_id];
    if (actionDefinition) {
      return {
        action,
        actionId: actionDefinition.id,
        actionName: actionDefinition.name,
        relationshipId: bridge.relationship_id
      };
    }
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
  if (itemSources.length !== 1 || !actionDefinition) {
    return null;
  }
  const itemSource = itemSources[0];
  return {
    action,
    actionId: actionDefinition.id,
    actionName: actionDefinition.name,
    relationshipId: `item:${itemSource.relationship_id}:${action}`,
    sourceItemRelationshipId: itemSource.relationship_id
  };
}

export function getQuickRollContext(action: QuickRollAction, activeWeapon?: string | null): string {
  if (action === "attack") {
    return activeWeapon ? `Attack with ${activeWeapon}` : "Attack";
  }
  return capitalize(action);
}

export function getQuickRollLabel(action: QuickRollAction, activeWeapon?: string | null): string {
  if (action === "attack" && activeWeapon) {
    return `Attack (${activeWeapon})`;
  }
  return capitalize(action);
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
