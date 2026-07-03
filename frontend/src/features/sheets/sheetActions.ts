import type { AssignedSheetAction } from "@/app/state/selectors";
import type { ActionDefinition } from "@/domain/models";
import type { SheetActionBridgePayload } from "@/infrastructure/ws/requestBuilders";

export function selectExplicitAssignedSheetActionIds(
  assignedActions: AssignedSheetAction[]
): Set<string> {
  return new Set(
    assignedActions.filter((entry) => entry.bridge).map((entry) => entry.actionId)
  );
}

export function selectOrderedSheetActions(
  actionDefinitions: Record<string, ActionDefinition>,
  actionOrder: string[]
): ActionDefinition[] {
  return actionOrder
    .map((actionId) => actionDefinitions[actionId])
    .filter((action): action is ActionDefinition => Boolean(action));
}

export function selectAvailableOrderedSheetActions(
  orderedActions: ActionDefinition[],
  assignedActionIds: ReadonlySet<string>,
  currentActionId?: string
): ActionDefinition[] {
  return orderedActions.filter(
    (action) => action.id === currentActionId || !assignedActionIds.has(action.id)
  );
}

export function selectAvailableSheetActions(
  actionDefinitions: Record<string, ActionDefinition>,
  actionOrder: string[],
  assignedActions: AssignedSheetAction[],
  currentActionId?: string
): ActionDefinition[] {
  return selectAvailableOrderedSheetActions(
    selectOrderedSheetActions(actionDefinitions, actionOrder),
    selectExplicitAssignedSheetActionIds(assignedActions),
    currentActionId
  );
}

export function toSheetActionBridgePayload(
  relationshipId: string,
  actionId: string
): SheetActionBridgePayload {
  return {
    relationship_id: relationshipId,
    action_id: actionId
  };
}
