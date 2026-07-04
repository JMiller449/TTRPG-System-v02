import type { ProficiencyDefinition } from "@/domain/models";
import type { ProficiencyDefinitionPayload } from "@/infrastructure/ws/requestBuilders";
import { makeId } from "@/shared/utils/id";

export interface ProficiencyEditorValues {
  id: string;
  name: string;
  description: string;
  category: "custom" | "weapon_family";
}

export function createEmptyProficiencyEditorValues(): ProficiencyEditorValues {
  return {
    id: "",
    name: "",
    description: "",
    category: "custom"
  };
}

export function toProficiencyEditorValues(
  proficiency: ProficiencyDefinition
): ProficiencyEditorValues {
  return {
    id: proficiency.id,
    name: proficiency.name,
    description: proficiency.description,
    category: proficiency.category ?? "custom"
  };
}

export function hasValidProficiencyEditorValues(
  values: ProficiencyEditorValues
): boolean {
  return values.name.trim().length > 0;
}

export function deriveProficiencyId(name: string, existingIds: readonly string[]): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!slug) {
    return makeId("proficiency");
  }
  if (!existingIds.includes(slug)) {
    return slug;
  }
  let suffix = 2;
  while (existingIds.includes(`${slug}_${suffix}`)) {
    suffix += 1;
  }
  return `${slug}_${suffix}`;
}

export function toProficiencyDefinitionPayload(
  values: ProficiencyEditorValues,
  proficiencyId = values.id
): ProficiencyDefinitionPayload {
  return {
    id: proficiencyId.trim(),
    name: values.name.trim(),
    description: values.description.trim(),
    category: values.category
  };
}

export function toUpdatedProficiencyDefinitionPayload(
  proficiency: ProficiencyDefinition | undefined,
  values: ProficiencyEditorValues
): ProficiencyDefinitionPayload | null {
  if (!proficiency) {
    return null;
  }

  return toProficiencyDefinitionPayload(values, proficiency.id);
}
