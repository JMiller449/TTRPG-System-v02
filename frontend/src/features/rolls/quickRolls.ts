import type { ActionDefinition, Sheet } from "@/domain/models";
import { buildPerformActionRequest } from "@/infrastructure/ws/requestBuilders";

export type QuickRollAction = "attack" | "dodge" | "parry" | "block";
export type QuickRollMode = "normal" | "advantage" | "disadvantage";
export type QuickRollVisibility = "public" | "gm_only";

export const QUICK_ROLL_ACTIONS: readonly QuickRollAction[] = ["attack", "dodge", "parry", "block"];

export interface ResolvedQuickRollAction {
  action: QuickRollAction;
  actionId: string;
  actionName: string;
  relationshipId: string;
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
  action: QuickRollAction
): ResolvedQuickRollAction | null {
  if (!sheet) {
    return null;
  }

  const relationshipId = getQuickRollRelationshipId(action);
  const bridge =
    sheet.actions[relationshipId] ??
    Object.values(sheet.actions).find((entry) => entry.entry_id === action);
  if (!bridge) {
    return null;
  }

  const actionDefinition = actions[bridge.entry_id];
  if (!actionDefinition) {
    return null;
  }

  return {
    action,
    actionId: actionDefinition.id,
    actionName: actionDefinition.name,
    relationshipId: bridge.relationship_id
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
  rollMode = "normal",
  visibility = "public"
}: {
  sheetId: string;
  resolution: ResolvedQuickRollAction;
  rollMode?: QuickRollMode;
  visibility?: QuickRollVisibility;
}): QuickRollExecutionRequest {
  return {
    request: buildPerformActionRequest({
      sheetId,
      actionId: resolution.actionId,
      rollMode,
      visibility
    }),
    label: `Perform action: ${resolution.actionName}${
      rollMode === "normal" ? "" : ` (${rollMode})`
    }`
  };
}
