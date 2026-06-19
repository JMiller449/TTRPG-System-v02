import type { ConditionPreset } from "@/domain/models";
import type { ProtocolApplicationRequest } from "@/infrastructure/ws/protocol";
import {
  buildCreateConditionPresetRequest,
  buildDeleteConditionPresetRequest,
  buildUpdateConditionPresetRequest,
  type ConditionPresetPayload
} from "@/infrastructure/ws/requestBuilders";
import {
  hasValidConditionPresetValues,
  removeConditionAugmentationTemplate,
  toConditionAugmentationTemplatePayload,
  toConditionPresetPayload,
  toUpdatedConditionPresetPayload,
  upsertConditionAugmentationTemplate,
  type ConditionPresetEditorValues
} from "@/features/conditions/conditionEditorValues";
import type { AugmentationEditorValues } from "@/features/augmentations/augmentationEditorValues";

export interface ConditionPresetSubmission {
  request: ProtocolApplicationRequest;
  label: string;
}

function conditionPartial(condition: ConditionPresetPayload): Record<string, unknown> {
  return condition as unknown as Record<string, unknown>;
}

export function selectOrderedConditionPresets(
  records: Record<string, ConditionPreset>,
  order: string[]
): ConditionPreset[] {
  return order.map((id) => records[id]).filter((condition): condition is ConditionPreset => Boolean(condition));
}

export function buildCreateConditionPresetSubmission(
  values: ConditionPresetEditorValues,
  conditionId: string
): ConditionPresetSubmission | null {
  if (!hasValidConditionPresetValues(values)) {
    return null;
  }

  const condition = toConditionPresetPayload({ values, conditionId });
  return {
    request: buildCreateConditionPresetRequest({ condition }),
    label: `Create condition: ${condition.name}`
  };
}

export function buildUpdateConditionPresetSubmission(
  condition: ConditionPreset | undefined,
  values: ConditionPresetEditorValues
): ConditionPresetSubmission | null {
  if (!hasValidConditionPresetValues(values)) {
    return null;
  }

  const updatedCondition = toUpdatedConditionPresetPayload(condition, values);
  if (!updatedCondition) {
    return null;
  }

  return {
    request: buildUpdateConditionPresetRequest({
      conditionId: updatedCondition.id,
      conditionPartial: conditionPartial(updatedCondition)
    }),
    label: `Update condition: ${updatedCondition.name}`
  };
}

export function buildDeleteConditionPresetSubmission(
  conditionId: string,
  condition: ConditionPreset | undefined
): ConditionPresetSubmission {
  return {
    request: buildDeleteConditionPresetRequest({ conditionId }),
    label: `Delete condition: ${condition?.name ?? conditionId}`
  };
}

export function buildUpsertConditionAugmentationSubmission({
  condition,
  values,
  augmentationId
}: {
  condition: ConditionPreset | undefined;
  values: AugmentationEditorValues;
  augmentationId: string;
}): ConditionPresetSubmission | null {
  if (!condition) {
    return null;
  }

  const augmentation = toConditionAugmentationTemplatePayload({
    values,
    augmentationId,
    conditionId: condition.id,
    conditionName: condition.name
  });
  const updatedCondition = upsertConditionAugmentationTemplate(condition, augmentation);
  if (!updatedCondition) {
    return null;
  }

  return {
    request: buildUpdateConditionPresetRequest({
      conditionId: condition.id,
      conditionPartial: conditionPartial(updatedCondition)
    }),
    label: `Save condition augmentation: ${augmentation?.name ?? "augmentation"}`
  };
}

export function buildRemoveConditionAugmentationSubmission({
  condition,
  augmentationId
}: {
  condition: ConditionPreset | undefined;
  augmentationId: string;
}): ConditionPresetSubmission | null {
  const updatedCondition = removeConditionAugmentationTemplate(condition, augmentationId);
  if (!condition || !updatedCondition) {
    return null;
  }

  const augmentation = condition.augmentation_templates?.find(
    (template) => template.id === augmentationId
  );

  return {
    request: buildUpdateConditionPresetRequest({
      conditionId: condition.id,
      conditionPartial: conditionPartial(updatedCondition)
    }),
    label: `Remove condition augmentation: ${augmentation?.name ?? "augmentation"}`
  };
}
