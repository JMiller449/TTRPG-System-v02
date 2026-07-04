import type { ActionDefinition, AttributeDefinition, ItemDefinition } from "@/domain/models";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ItemDefinitionCard } from "@/features/items/components/ItemDefinitionCard";

export function ItemDefinitionList({
  items,
  actions,
  attributeDefinitions,
  onEdit,
  onDelete
}: {
  items: ItemDefinition[];
  actions: Record<string, ActionDefinition>;
  attributeDefinitions: Record<string, AttributeDefinition>;
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
          attributeDefinitions={attributeDefinitions}
          onEdit={() => onEdit(item)}
          onDelete={() => onDelete(item.id)}
        />
      ))}
    </div>
  );
}
