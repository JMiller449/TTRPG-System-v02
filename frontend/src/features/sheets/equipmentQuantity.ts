import type { ItemBridge } from "@/domain/models";
import { buildUpdateInstancedSheetItemRequest } from "@/infrastructure/ws/requestBuilders";

export function buildEquipmentQuantitySubmission({
  instanceId,
  bridge,
  count,
  itemName
}: {
  instanceId: string;
  bridge: ItemBridge;
  count: number;
  itemName: string;
}): {
  request: ReturnType<typeof buildUpdateInstancedSheetItemRequest>;
  label: string;
} | null {
  if (!Number.isSafeInteger(count) || count < 0) {
    return null;
  }

  return {
    request: buildUpdateInstancedSheetItemRequest({
      instanceId,
      relationshipId: bridge.relationship_id,
      bridge: {
        ...bridge,
        count,
        equipped: count > 0 && bridge.equipped
      }
    }),
    label: `Update quantity: ${itemName}`
  };
}
