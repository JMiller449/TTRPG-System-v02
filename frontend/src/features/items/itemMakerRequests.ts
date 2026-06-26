import type { ItemDefinition } from "@/domain/models";
import type { ProtocolApplicationRequest } from "@/infrastructure/ws/protocol";
import {
  buildCreateItemRequest,
  buildDeleteItemRequest,
  buildUpdateItemRequest
} from "@/infrastructure/ws/requestBuilders";
import {
  toItemDefinitionPayload,
  toUpdatedItemDefinitionPayload,
  type ItemEditorValues
} from "@/features/items/itemEditorValues";

export interface ItemMakerSubmission {
  request: ProtocolApplicationRequest;
  label: string;
}

export function selectOrderedItemDefinitions(
  itemRecords: Record<string, ItemDefinition>,
  itemOrder: string[]
): ItemDefinition[] {
  return itemOrder.map((id) => itemRecords[id]).filter((item): item is ItemDefinition => Boolean(item));
}

export function buildCreateItemSubmission(values: ItemEditorValues, itemId: string): ItemMakerSubmission | null {
  if (!values.name.trim()) {
    return null;
  }

  const item = toItemDefinitionPayload(values, itemId);
  return {
    request: buildCreateItemRequest({ item }),
    label: `Create item: ${item.name}`
  };
}

export function buildUpdateItemSubmission(
  item: ItemDefinition | undefined,
  values: ItemEditorValues
): ItemMakerSubmission | null {
  if (!item || !values.name.trim()) {
    return null;
  }

  const updatedItem = toUpdatedItemDefinitionPayload(item, values);
  return {
    request: buildUpdateItemRequest({
      itemId: item.id,
      item: updatedItem
    }),
    label: `Update item: ${updatedItem.name}`
  };
}

export function buildDeleteItemSubmission(
  itemId: string,
  item: ItemDefinition | undefined
): ItemMakerSubmission {
  return {
    request: buildDeleteItemRequest({ itemId }),
    label: `Delete item: ${item?.name ?? "item"}`
  };
}
