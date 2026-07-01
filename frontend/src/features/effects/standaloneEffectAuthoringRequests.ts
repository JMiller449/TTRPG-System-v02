import type { StandaloneEffectDefinition } from "@/domain/models";
import type { AugmentationEditorValues } from "@/features/augmentations/augmentationEditorValues";
import {
  hasValidStandaloneEffectValues,
  toStandaloneEffectDefinitionPayload,
  toUpdatedStandaloneEffectDefinitionPayload
} from "@/features/effects/standaloneEffectEditorValues";
import type { ProtocolApplicationRequest } from "@/infrastructure/ws/protocol";
import {
  buildCreateStandaloneEffectRequest,
  buildDeleteStandaloneEffectRequest,
  buildGetActionFormulaAuthoringMetadataRequest,
  buildGetAugmentationTargetMetadataRequest,
  buildUpdateStandaloneEffectRequest
} from "@/infrastructure/ws/requestBuilders";

export interface StandaloneEffectAuthoringSubmission {
  request: ProtocolApplicationRequest;
  label: string;
  confirmation?: string;
}

export function selectOrderedStandaloneEffects(
  records: Record<string, StandaloneEffectDefinition>,
  order: string[]
): StandaloneEffectDefinition[] {
  return order
    .map((id) => records[id])
    .filter((effect): effect is StandaloneEffectDefinition => Boolean(effect));
}

export function buildLoadStandaloneEffectTargetMetadataSubmission(): StandaloneEffectAuthoringSubmission {
  return {
    request: buildGetAugmentationTargetMetadataRequest({ context: "runtime" }),
    label: "Load standalone effect targets"
  };
}

export function buildLoadStandaloneEffectFormulaMetadataSubmission(): StandaloneEffectAuthoringSubmission {
  return {
    request: buildGetActionFormulaAuthoringMetadataRequest(),
    label: "Load standalone effect formula metadata"
  };
}

export function buildCreateStandaloneEffectSubmission(
  values: AugmentationEditorValues,
  effectId: string
): StandaloneEffectAuthoringSubmission | null {
  if (!hasValidStandaloneEffectValues(values)) {
    return null;
  }
  const effect = toStandaloneEffectDefinitionPayload(values, effectId);
  return {
    request: buildCreateStandaloneEffectRequest({ effect }),
    label: `Create standalone effect: ${effect.name}`
  };
}

export function buildUpdateStandaloneEffectSubmission(
  effect: StandaloneEffectDefinition | undefined,
  values: AugmentationEditorValues
): StandaloneEffectAuthoringSubmission | null {
  if (!hasValidStandaloneEffectValues(values)) {
    return null;
  }
  const updatedEffect = toUpdatedStandaloneEffectDefinitionPayload(effect, values);
  if (!updatedEffect) {
    return null;
  }
  return {
    request: buildUpdateStandaloneEffectRequest({
      effectId: updatedEffect.id,
      effect: updatedEffect
    }),
    label: `Update standalone effect: ${updatedEffect.name}`
  };
}

export function buildDeleteStandaloneEffectSubmission(
  effectId: string,
  effect: StandaloneEffectDefinition | undefined
): StandaloneEffectAuthoringSubmission {
  const name = effect?.name ?? effectId;
  return {
    request: buildDeleteStandaloneEffectRequest({ effectId }),
    label: `Delete standalone effect: ${name}`,
    confirmation: `Delete action-controlled effect "${name}"? Effects referenced by actions or active on a sheet cannot be deleted.`
  };
}
