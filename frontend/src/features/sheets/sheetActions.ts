import type { AssignedSheetAction } from "@/app/state/selectors";
import type { ActionDefinition } from "@/domain/models";
import type { SheetActionBridgePayload } from "@/infrastructure/ws/requestBuilders";

export function selectAvailableSheetActions(
  actionDefinitions: Record<string, ActionDefinition>,
  actionOrder: string[],
  assignedActions: AssignedSheetAction[],
  currentActionId?: string
): ActionDefinition[] {
  const assignedActionIds = new Set(
    assignedActions.filter((entry) => entry.bridge).map((entry) => entry.actionId)
  );
  return actionOrder
    .map((actionId) => actionDefinitions[actionId])
    .filter((action): action is ActionDefinition => Boolean(action))
    .filter((action) => action.id === currentActionId || !assignedActionIds.has(action.id));
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
