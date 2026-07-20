import type { ItemDefinition } from "@/domain/models";

export type ItemCatalogFolderSelection = string | null;

export interface ItemCatalogFolderSummary {
  name: string;
  count: number;
}

export function selectItemCatalogFolders(
  items: readonly ItemDefinition[]
): ItemCatalogFolderSummary[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const folder = item.catalog_folder?.trim() ?? "";
    if (!folder) {
      continue;
    }
    counts.set(folder, (counts.get(folder) ?? 0) + 1);
  }
  return Array.from(counts, ([name, count]) => ({ name, count })).sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: "base" })
  );
}

export function filterItemCatalogItems(
  items: readonly ItemDefinition[],
  selectedFolder: ItemCatalogFolderSelection,
  query: string
): ItemDefinition[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);

  return items.filter((item) => {
    const folder = item.catalog_folder?.trim() ?? "";
    if (selectedFolder !== null && folder !== selectedFolder) {
      return false;
    }
    if (terms.length === 0) {
      return true;
    }
    const searchable = [item.name, item.id, item.category ?? "", item.rank ?? "", folder]
      .join(" ")
      .toLocaleLowerCase();
    return terms.every((term) => searchable.includes(term));
  });
}
