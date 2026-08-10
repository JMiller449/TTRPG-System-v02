import type { ConditionPreset, ConditionVisibility } from "@/domain/models";
import type { ConditionPresetPayload } from "@/infrastructure/ws/requestBuilders";

export interface ConditionPresetEditorValues {
  name: string;
  description: string;
  visibility: ConditionVisibility;
  effectIds: string[];
}

export function createEmptyConditionPresetEditorValues(): ConditionPresetEditorValues {
  return {
    name: "",
    description: "",
    visibility: "public",
    effectIds: []
  };
}

export function toConditionPresetEditorValues(
  condition: ConditionPreset
): ConditionPresetEditorValues {
  return {
    name: condition.name,
    description: condition.description ?? "",
    visibility: condition.visibility ?? "public",
    effectIds: [...(condition.effect_ids ?? [])]
  };
}

export function toConditionPresetPayload({
  values,
  conditionId
}: {
  values: ConditionPresetEditorValues;
  conditionId: string;
}): ConditionPresetPayload {
  return {
    id: conditionId,
    name: values.name.trim(),
    description: values.description.trim(),
    visibility: values.visibility,
    effect_ids: [...values.effectIds]
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
