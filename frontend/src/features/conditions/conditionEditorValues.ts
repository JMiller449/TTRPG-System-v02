import type {
  Augmentation,
  ConditionPreset,
  ConditionVisibility
} from "@/domain/models";
import type {
  AugmentationPayload,
  ConditionPresetPayload
} from "@/infrastructure/ws/requestBuilders";
import {
  hasValidAugmentationEditorValues,
  toAugmentationEffectPayload,
  type AugmentationEditorValues
} from "@/features/augmentations/augmentationEditorValues";

export interface ConditionPresetEditorValues {
  name: string;
  description: string;
  visibility: ConditionVisibility;
}

export function createEmptyConditionPresetEditorValues(): ConditionPresetEditorValues {
  return {
    name: "",
    description: "",
    visibility: "public"
  };
}

function cleanPath(path: string[]): string[] {
  return path.map((segment) => segment.trim()).filter(Boolean);
}

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function conditionTemplates(condition: ConditionPreset | undefined): Augmentation[] {
  return condition?.augmentation_templates ?? [];
}

export function toConditionPresetEditorValues(
  condition: ConditionPreset
): ConditionPresetEditorValues {
  return {
    name: condition.name,
    description: condition.description ?? "",
    visibility: condition.visibility ?? "public"
  };
}

export function toConditionPresetPayload({
  values,
  conditionId,
  augmentationTemplates = []
}: {
  values: ConditionPresetEditorValues;
  conditionId: string;
  augmentationTemplates?: Augmentation[];
}): ConditionPresetPayload {
  return {
    id: conditionId,
    name: values.name.trim(),
    description: values.description.trim(),
    visibility: values.visibility,
    augmentation_ids: augmentationTemplates.map((augmentation) => augmentation.id),
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
    conditionId: condition.id,
    augmentationTemplates: conditionTemplates(condition)
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
}): AugmentationPayload | null {
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
    lifecycle: {
      duration: optionalText(values.duration),
      expires_at: optionalText(values.expiresAt),
      removal_condition: optionalText(values.removalCondition)
    }
  };
}

export function upsertConditionAugmentationTemplate(
  condition: ConditionPreset | undefined,
  augmentation: AugmentationPayload | null
): ConditionPresetPayload | null {
  if (!condition || !augmentation) {
    return null;
  }

  const augmentationTemplates = [
    ...conditionTemplates(condition).filter((template) => template.id !== augmentation.id),
    augmentation
  ];

  return toConditionPresetPayload({
    values: toConditionPresetEditorValues(condition),
    conditionId: condition.id,
    augmentationTemplates
  });
}

export function removeConditionAugmentationTemplate(
  condition: ConditionPreset | undefined,
  augmentationId: string
): ConditionPresetPayload | null {
  if (!condition || !augmentationId.trim()) {
    return null;
  }

  return toConditionPresetPayload({
    values: toConditionPresetEditorValues(condition),
    conditionId: condition.id,
    augmentationTemplates: conditionTemplates(condition).filter(
      (template) => template.id !== augmentationId
    )
  });
}
