import type { StandaloneEffectDefinition } from "@/domain/models";
import {
  hasValidAugmentationEditorValues,
  toAugmentationEffectPayload,
  type AugmentationEditorValues
} from "@/features/augmentations/augmentationEditorValues";
import type { StandaloneEffectDefinitionPayload } from "@/infrastructure/ws/requestBuilders";

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanPath(path: string[]): string[] {
  return path.map((segment) => segment.trim()).filter(Boolean);
}

export function hasValidStandaloneEffectValues(values: AugmentationEditorValues): boolean {
  return values.targetRoot === "instance" && hasValidAugmentationEditorValues(values);
}

export function toStandaloneEffectDefinitionPayload(
  values: AugmentationEditorValues,
  effectId: string
): StandaloneEffectDefinitionPayload {
  return {
    id: effectId,
    name: values.name.trim(),
    description: values.description.trim(),
    scope: "instance",
    target: {
      root: "instance",
      path: cleanPath(values.targetPath)
    },
    effect: toAugmentationEffectPayload(values),
    active: values.active,
    lifecycle: {
      duration: optionalText(values.duration),
      expires_at: optionalText(values.expiresAt),
      removal_condition: optionalText(values.removalCondition)
    }
  };
}

export function toUpdatedStandaloneEffectDefinitionPayload(
  effect: StandaloneEffectDefinition | undefined,
  values: AugmentationEditorValues
): StandaloneEffectDefinitionPayload | null {
  if (!effect) {
    return null;
  }
  return toStandaloneEffectDefinitionPayload(values, effect.id);
}
