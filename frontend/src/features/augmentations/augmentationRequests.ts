import type { Augmentation, ItemDefinition } from "@/domain/models";
import type { ProtocolApplicationRequest } from "@/infrastructure/ws/protocol";
import {
  buildRemoveItemAugmentationTemplateRequest,
  buildUpsertItemAugmentationTemplateRequest
} from "@/infrastructure/ws/requestBuilders";
import {
  hasValidAugmentationEditorValues,
  toItemAugmentationTemplatePayload,
  type AugmentationEditorValues
} from "@/features/augmentations/augmentationEditorValues";

export interface AugmentationTemplateSubmission {
  request: ProtocolApplicationRequest;
  label: string;
}

export function selectItemAugmentationTemplates(item: ItemDefinition | undefined): Augmentation[] {
  return item?.augmentation_templates ?? [];
}

export function buildUpsertItemAugmentationTemplateSubmission({
  item,
  values,
  augmentationId
}: {
  item: ItemDefinition | undefined;
  values: AugmentationEditorValues;
  augmentationId: string;
}): AugmentationTemplateSubmission | null {
  if (!item || !hasValidAugmentationEditorValues(values)) {
    return null;
  }

  const augmentation = toItemAugmentationTemplatePayload({
    values,
    augmentationId,
    itemId: item.id,
    itemName: item.name
  });

  return {
    request: buildUpsertItemAugmentationTemplateRequest({
      itemId: item.id,
      augmentation
    }),
    label: `Save augmentation: ${augmentation.name}`
  };
}

export function buildRemoveItemAugmentationTemplateSubmission({
  item,
  augmentationId
}: {
  item: ItemDefinition | undefined;
  augmentationId: string;
}): AugmentationTemplateSubmission | null {
  if (!item || !augmentationId.trim()) {
    return null;
  }

  const augmentation = selectItemAugmentationTemplates(item).find(
    (template) => template.id === augmentationId
  );

  return {
    request: buildRemoveItemAugmentationTemplateRequest({
      itemId: item.id,
      augmentationId
    }),
    label: `Remove augmentation: ${augmentation?.name ?? "augmentation"}`
  };
}
