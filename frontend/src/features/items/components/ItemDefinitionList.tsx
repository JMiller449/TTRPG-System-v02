import type { ItemDefinition } from "@/domain/models";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ItemDefinitionCard } from "@/features/items/components/ItemDefinitionCard";

export function ItemDefinitionList({
  items,
  onEdit,
  onDelete
}: {
  items: ItemDefinition[];
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
          onEdit={() => onEdit(item)}
          onDelete={() => onDelete(item.id)}
        />
      ))}
    </div>
  );
}
