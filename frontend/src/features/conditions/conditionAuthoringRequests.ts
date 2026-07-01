import type { ConditionPreset } from "@/domain/models";
import type { ProtocolApplicationRequest } from "@/infrastructure/ws/protocol";
import {
  buildCreateConditionPresetRequest,
  buildDeleteConditionPresetRequest,
  buildGetAugmentationTargetMetadataRequest,
  buildUpdateConditionPresetRequest,
  type ConditionPresetPayload
} from "@/infrastructure/ws/requestBuilders";
import {
  hasValidConditionPresetValues,
  toConditionPresetPayload,
  toUpdatedConditionPresetPayload,
  type ConditionPresetEditorValues
} from "@/features/conditions/conditionEditorValues";

export interface ConditionPresetSubmission {
  request: ProtocolApplicationRequest;
  label: string;
  confirmation?: string;
}

function conditionPartial(condition: ConditionPresetPayload): Record<string, unknown> {
  return condition as unknown as Record<string, unknown>;
}

export function selectOrderedConditionPresets(
  records: Record<string, ConditionPreset>,
  order: string[]
): ConditionPreset[] {
  return order
    .map((id) => records[id])
    .filter((condition): condition is ConditionPreset => Boolean(condition));
}

export function buildLoadConditionAugmentationTargetMetadataSubmission(): ConditionPresetSubmission {
  return {
    request: buildGetAugmentationTargetMetadataRequest({ context: "condition_template" }),
    label: "Load condition augmentation targets"
  };
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
    label: `Delete condition: ${condition?.name ?? conditionId}`,
    confirmation: `Delete condition "${condition?.name ?? conditionId}"?`
  };
}
