import { useMemo, useState } from "react";
import type { ItemDefinition } from "@/domain/models";
import {
  filterItemCatalogItems,
  selectItemCatalogFolders,
  type ItemCatalogFolderSelection
} from "@/features/items/itemCatalogFolders";
import { CatalogTileGrid } from "@/shared/ui/CatalogTileGrid";

export function ItemCatalogBrowser({
  items,
  selectedId,
  onSelect
}: {
  items: readonly ItemDefinition[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}): JSX.Element {
  const [selectedFolder, setSelectedFolder] = useState<ItemCatalogFolderSelection>(null);
  const [query, setQuery] = useState("");
  const folders = useMemo(() => selectItemCatalogFolders(items), [items]);
  const visibleItems = useMemo(
    () => filterItemCatalogItems(items, selectedFolder, query),
    [items, query, selectedFolder]
  );
  const unfiledCount = items.filter((item) => !(item.catalog_folder?.trim() ?? "")).length;

  return (
    <div className="item-catalog-browser">
      <label className="item-catalog-browser__search">
        <span>Search items</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name, ID, category, rank, or folder"
        />
      </label>
      <nav className="item-catalog-browser__folders" aria-label="Item catalog folders">
        <button
          type="button"
          className={selectedFolder === null ? "item-catalog-folder--selected" : undefined}
          aria-pressed={selectedFolder === null}
          onClick={() => setSelectedFolder(null)}
        >
          All <span>{items.length}</span>
        </button>
        {folders.map((folder) => (
          <button
            type="button"
            key={folder.name}
            className={selectedFolder === folder.name ? "item-catalog-folder--selected" : undefined}
            aria-pressed={selectedFolder === folder.name}
            onClick={() => setSelectedFolder(folder.name)}
          >
            {folder.name} <span>{folder.count}</span>
          </button>
        ))}
        <button
          type="button"
          className={selectedFolder === "" ? "item-catalog-folder--selected" : undefined}
          aria-pressed={selectedFolder === ""}
          onClick={() => setSelectedFolder("")}
        >
          Unfiled <span>{unfiledCount}</span>
        </button>
      </nav>
      <div className="item-catalog-browser__results">
        <CatalogTileGrid
          items={visibleItems.map((item) => ({ id: item.id, name: item.name }))}
          selectedId={selectedId}
          emptyMessage={
            items.length === 0
              ? "No items created yet."
              : query.trim()
                ? "No items match this search."
                : "No items in this folder."
          }
          onSelect={onSelect}
        />
      </div>
    </div>
  );
}
