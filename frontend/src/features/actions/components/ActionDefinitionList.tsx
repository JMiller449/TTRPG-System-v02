import type { ActionDefinition, AttributeDefinition } from "@/domain/models";
import { ActionDefinitionCard } from "@/features/actions/components/ActionDefinitionCard";
import { EmptyState } from "@/shared/ui/EmptyState";

export function ActionDefinitionList({
  actions,
  attributeDefinitions,
  onEdit,
  onDelete
}: {
  actions: ActionDefinition[];
  attributeDefinitions: Record<string, AttributeDefinition>;
  onEdit: (action: ActionDefinition) => void;
  onDelete: (actionId: string) => void;
}): JSX.Element {
  return (
    <div className="list">
      {actions.length === 0 ? <EmptyState message="No actions created yet." /> : null}
      {actions.map((action) => (
        <ActionDefinitionCard
          key={action.id}
          action={action}
          attributeDefinitions={attributeDefinitions}
          onEdit={() => onEdit(action)}
          onDelete={() => onDelete(action.id)}
        />
      ))}
    </div>
  );
}
