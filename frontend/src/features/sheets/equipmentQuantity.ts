import type { ItemBridge } from "@/domain/models";
import { buildUpdateAttachedSheetItemRequest } from "@/infrastructure/ws/requestBuilders";

export function buildEquipmentQuantitySubmission({
  sheetId,
  bridge,
  count,
  itemName
}: {
  sheetId: string;
  bridge: ItemBridge;
  count: number;
  itemName: string;
}): {
  request: ReturnType<typeof buildUpdateAttachedSheetItemRequest>;
  label: string;
} | null {
  if (!Number.isSafeInteger(count) || count < 0) {
    return null;
  }

  return {
    request: buildUpdateAttachedSheetItemRequest({
      sheetId,
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
