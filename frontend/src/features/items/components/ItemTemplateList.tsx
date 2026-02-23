import type { ItemTemplate } from "@/domain/models";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ItemTemplateCard } from "@/features/items/components/ItemTemplateCard";

export function ItemTemplateList({
  items,
  onEdit,
  onDelete
}: {
  items: ItemTemplate[];
  onEdit: (item: ItemTemplate) => void;
  onDelete: (itemId: string) => void;
}): JSX.Element {
  return (
    <div className="list">
      {items.length === 0 ? <EmptyState message="No items created yet." /> : null}
      {items.map((item) => (
        <ItemTemplateCard
          key={item.id}
          item={item}
          onEdit={() => onEdit(item)}
          onDelete={() => onDelete(item.id)}
        />
      ))}
    </div>
  );
}
