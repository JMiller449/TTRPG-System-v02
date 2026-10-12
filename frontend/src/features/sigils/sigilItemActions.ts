import type { AppState } from "@/app/state/types";
import type { AssignedSheetAction } from "@/app/state/selectors";
import type { SigilNodePayload, SigilPayload } from "@/generated/backendProtocol";
import type {
  ActionExecutionVisibility,
  ActionRollMode
} from "@/infrastructure/ws/requestBuilders";
import {
  buildPerformActionRequest,
  buildSigilNodeRequest
} from "@/infrastructure/ws/requestBuilders";
import { makeId } from "@/shared/utils/id";

export interface ItemSigilNode {
  sigilId: string;
  sigilName: string;
  node: SigilNodePayload;
}

export function itemSigilNodes(
  sigils: Record<string, SigilPayload>,
  instanceId: string,
  relationshipId: string
): ItemSigilNode[] {
  return Object.values(sigils)
    .filter(
      (sigil) =>
        sigil.owner_instance_id === instanceId && sigil.item_relationship_id === relationshipId
    )
    .flatMap((sigil) =>
      sigil.nodes
        .filter((node) => node.action_id)
        .map((node) => ({
          sigilId: sigil.id,
          sigilName: sigil.nodes.find((entry) => !entry.parent_id)?.name ?? sigil.id,
          node
        }))
    );
}

export function selectChargedItemSigilActions(
  state: AppState,
  instanceId: string
): AssignedSheetAction[] {
  const inventory = state.serverState.persistentSheets[instanceId]?.items ?? {};
  return Object.entries(inventory).flatMap(([key, bridge]) => {
    const item = state.serverState.items[bridge.item_id];
    if (!item || bridge.count !== 1) return [];
    return itemSigilNodes(state.serverState.sigils, instanceId, key).flatMap(
      ({ sigilId, sigilName, node }) => {
        const action = node.action_id ? state.serverState.actions[node.action_id] : undefined;
        if (!node.charge || !action) return [];
        return [
          {
            relationshipId: `sigil:${sigilId}:${node.id}`,
            actionId: action.id,
            action,
            sourceItemRelationshipId: key,
            sourceItemName: item.name,
            sourceItemAvailability: "carried" as const,
            sigilId,
            sigilNodeId: node.id,
            sigilName
          }
        ];
      }
    );
  });
}

export function buildAssignedActionInvocation(
  entry: AssignedSheetAction,
  instanceId: string,
  rollMode: ActionRollMode,
  visibility: ActionExecutionVisibility
) {
  if (entry.sigilId && entry.sigilNodeId) {
    return buildSigilNodeRequest(
      "activate_sigil",
      {
        sigil_id: entry.sigilId,
        node_id: entry.sigilNodeId,
        instance_id: instanceId,
        roll_mode: rollMode,
        visibility
      },
      makeId("request")
    );
  }
  return buildPerformActionRequest({
    sheetId: instanceId,
    actionId: entry.actionId,
    sourceItemRelationshipId: entry.sourceItemRelationshipId,
    rollMode,
    visibility
  });
}
