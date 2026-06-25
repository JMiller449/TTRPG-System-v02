import type { ProficiencyDefinition } from "@/domain/models";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ProficiencyDefinitionCard } from "@/features/proficiencies/components/ProficiencyDefinitionCard";

export function ProficiencyDefinitionList({
  proficiencies,
  onEdit,
  onDelete
}: {
  proficiencies: ProficiencyDefinition[];
  onEdit: (proficiency: ProficiencyDefinition) => void;
  onDelete: (proficiencyId: string) => void;
}): JSX.Element {
  return (
    <div className="list">
      {proficiencies.length === 0 ? <EmptyState message="No proficiencies created yet." /> : null}
      {proficiencies.map((proficiency) => (
        <ProficiencyDefinitionCard
          key={proficiency.id}
          proficiency={proficiency}
          onEdit={() => onEdit(proficiency)}
          onDelete={() => onDelete(proficiency.id)}
        />
      ))}
    </div>
  );
}
