import type { ProficiencyDefinition } from "@/domain/models";

export function selectAuthoritativeProficiencies(
  proficiencies: Record<string, ProficiencyDefinition>
): ProficiencyDefinition[] {
  return Array.from(
    new Map(
      Object.values(proficiencies).map((proficiency) => [proficiency.id, proficiency])
    ).values()
  ).sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
}
