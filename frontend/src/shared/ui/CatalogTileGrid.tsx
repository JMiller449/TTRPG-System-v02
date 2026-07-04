import { EmptyState } from "@/shared/ui/EmptyState";

export interface CatalogTileItem {
  id: string;
  name: string;
  disabled?: boolean;
  disabledReason?: string;
}

export function CatalogTileGrid({
  items,
  selectedId,
  emptyMessage,
  onSelect
}: {
  items: readonly CatalogTileItem[];
  selectedId: string | null;
  emptyMessage: string;
  onSelect: (id: string) => void;
}): JSX.Element {
  if (items.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <div className="catalog-tile-grid">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`catalog-tile ${selectedId === item.id ? "catalog-tile--selected" : ""}`}
          aria-pressed={selectedId === item.id}
          disabled={item.disabled}
          title={item.disabledReason ?? item.name}
          onClick={() => onSelect(item.id)}
        >
          {item.name}
        </button>
      ))}
    </div>
  );
}
