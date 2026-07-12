import type { Augmentation, ConditionPreset, ConditionVisibility } from "@/domain/models";
import type { ConditionPresetPayload } from "@/infrastructure/ws/requestBuilders";
import {
  hasValidAugmentationEditorValues,
  toAugmentationEffectPayload,
  toAugmentationLifecyclePayload,
  type AugmentationEditorValues
} from "@/features/augmentations/augmentationEditorValues";

export interface ConditionPresetEditorValues {
  name: string;
  description: string;
  visibility: ConditionVisibility;
  augmentationTemplates: Augmentation[];
}

export function createEmptyConditionPresetEditorValues(): ConditionPresetEditorValues {
  return {
    name: "",
    description: "",
    visibility: "public",
    augmentationTemplates: []
  };
}

function cleanPath(path: string[]): string[] {
  return path.map((segment) => segment.trim()).filter(Boolean);
}

export function toConditionPresetEditorValues(
  condition: ConditionPreset
): ConditionPresetEditorValues {
  return {
    name: condition.name,
    description: condition.description ?? "",
    visibility: condition.visibility ?? "public",
    augmentationTemplates: [...(condition.augmentation_templates ?? [])]
  };
}

export function toConditionPresetPayload({
  values,
  conditionId
}: {
  values: ConditionPresetEditorValues;
  conditionId: string;
}): ConditionPresetPayload {
  const conditionName = values.name.trim();
  const augmentationTemplates = values.augmentationTemplates.map((augmentation) => ({
    ...augmentation,
    source: {
      type: "condition" as const,
      id: conditionId,
      label: conditionName || null
    },
    scope: "instance" as const,
    target: {
      ...augmentation.target,
      root: "instance" as const
    },
    applied: false,
    applied_target_id: null
  }));

  return {
    id: conditionId,
    name: conditionName,
    description: values.description.trim(),
    visibility: values.visibility,
    augmentation_templates: augmentationTemplates
  };
}

export function toUpdatedConditionPresetPayload(
  condition: ConditionPreset | undefined,
  values: ConditionPresetEditorValues
): ConditionPresetPayload | null {
  if (!condition) {
    return null;
  }

  return toConditionPresetPayload({
    values,
    conditionId: condition.id
  });
}

export function hasValidConditionPresetValues(values: ConditionPresetEditorValues): boolean {
  return values.name.trim().length > 0;
}

export function toConditionAugmentationTemplatePayload({
  values,
  augmentationId,
  conditionId,
  conditionName
}: {
  values: AugmentationEditorValues;
  augmentationId: string;
  conditionId: string;
  conditionName: string;
}): Augmentation | null {
  if (!hasValidAugmentationEditorValues(values)) {
    return null;
  }

  return {
    id: augmentationId,
    name: values.name.trim(),
    description: values.description.trim(),
    source: {
      type: "condition",
      id: conditionId,
      label: conditionName.trim() || null
    },
    scope: "instance",
    target: {
      root: "instance",
      path: cleanPath(values.targetPath)
    },
    effect: toAugmentationEffectPayload(values),
    active: values.active,
    applied: false,
    applied_target_id: null,
    lifecycle: toAugmentationLifecyclePayload(values)
  };
}

export function upsertConditionEffect(
  values: ConditionPresetEditorValues,
  augmentation: Augmentation
): ConditionPresetEditorValues {
  const existingIndex = values.augmentationTemplates.findIndex(
    (template) => template.id === augmentation.id
  );
  if (existingIndex < 0) {
    return {
      ...values,
      augmentationTemplates: [...values.augmentationTemplates, augmentation]
    };
  }

  return {
    ...values,
    augmentationTemplates: values.augmentationTemplates.map((template) =>
      template.id === augmentation.id ? augmentation : template
    )
  };
}

export function removeConditionEffect(
  values: ConditionPresetEditorValues,
  augmentationId: string
): ConditionPresetEditorValues {
  return {
    ...values,
    augmentationTemplates: values.augmentationTemplates.filter(
      (template) => template.id !== augmentationId
    )
  };
}
