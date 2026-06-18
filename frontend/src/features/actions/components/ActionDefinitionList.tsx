import type { ActionDefinition } from "@/domain/models";
import { ActionDefinitionCard } from "@/features/actions/components/ActionDefinitionCard";
import { EmptyState } from "@/shared/ui/EmptyState";

export function ActionDefinitionList({
  actions,
  onEdit,
  onDelete
}: {
  actions: ActionDefinition[];
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
          onEdit={() => onEdit(action)}
          onDelete={() => onDelete(action.id)}
        />
      ))}
    </div>
  );
}
