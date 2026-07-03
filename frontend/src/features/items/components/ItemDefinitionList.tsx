import type { ActionDefinition, FactDefinition, ItemDefinition } from "@/domain/models";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ItemDefinitionCard } from "@/features/items/components/ItemDefinitionCard";

export function ItemDefinitionList({
  items,
  actions,
  factDefinitions,
  onEdit,
  onDelete
}: {
  items: ItemDefinition[];
  actions: Record<string, ActionDefinition>;
  factDefinitions: Record<string, FactDefinition>;
  onEdit: (item: ItemDefinition) => void;
  onDelete: (itemId: string) => void;
}): JSX.Element {
  return (
    <div className="list">
      {items.length === 0 ? <EmptyState message="No items created yet." /> : null}
      {items.map((item) => (
        <ItemDefinitionCard
          key={item.id}
          item={item}
          actions={actions}
          factDefinitions={factDefinitions}
          onEdit={() => onEdit(item)}
          onDelete={() => onDelete(item.id)}
        />
      ))}
    </div>
  );
}
