import type { ProficiencyDefinition } from "@/domain/models";
import type { ProtocolApplicationRequest } from "@/infrastructure/ws/protocol";
import {
  buildCreateProficiencyRequest,
  buildDeleteProficiencyRequest,
  buildUpdateProficiencyRequest
} from "@/infrastructure/ws/requestBuilders";
import {
  hasValidProficiencyEditorValues,
  toProficiencyDefinitionPayload,
  toUpdatedProficiencyDefinitionPayload,
  type ProficiencyEditorValues
} from "@/features/proficiencies/proficiencyEditorValues";

export interface ProficiencyAuthoringSubmission {
  request: ProtocolApplicationRequest;
  label: string;
}

export function selectOrderedProficiencyDefinitions(
  records: Record<string, ProficiencyDefinition>,
  order: string[]
): ProficiencyDefinition[] {
  return order
    .map((id) => records[id])
    .filter((proficiency): proficiency is ProficiencyDefinition => Boolean(proficiency));
}

export function buildCreateProficiencySubmission(
  values: ProficiencyEditorValues
): ProficiencyAuthoringSubmission | null {
  if (!hasValidProficiencyEditorValues(values)) {
    return null;
  }

  const proficiency = toProficiencyDefinitionPayload(values);
  return {
    request: buildCreateProficiencyRequest({ proficiency }),
    label: `Create proficiency: ${proficiency.name}`
  };
}

export function buildUpdateProficiencySubmission(
  proficiency: ProficiencyDefinition | undefined,
  values: ProficiencyEditorValues
): ProficiencyAuthoringSubmission | null {
  if (!hasValidProficiencyEditorValues(values)) {
    return null;
  }

  const updatedProficiency = toUpdatedProficiencyDefinitionPayload(proficiency, values);
  if (!updatedProficiency) {
    return null;
  }

  return {
    request: buildUpdateProficiencyRequest({
      proficiencyId: updatedProficiency.id,
      proficiency: updatedProficiency
    }),
    label: `Update proficiency: ${updatedProficiency.name}`
  };
}

export function buildDeleteProficiencySubmission(
  proficiencyId: string,
  proficiency: ProficiencyDefinition | undefined
): ProficiencyAuthoringSubmission {
  return {
    request: buildDeleteProficiencyRequest({ proficiencyId }),
    label: `Delete proficiency: ${proficiency?.name ?? proficiencyId}`
  };
}
