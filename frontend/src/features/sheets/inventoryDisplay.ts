import type { ItemBridge, ItemDefinition } from "@/domain/models";

export interface InventoryTreeEntry {
  bridge: ItemBridge;
  depth: number;
}

export function buildInventoryTree(entries: ItemBridge[]): InventoryTreeEntry[] {
  const byId = new Map(entries.map((entry) => [entry.relationship_id, entry]));
  const children = new Map<string, ItemBridge[]>();
  for (const entry of entries) {
    const parentId = entry.parent_container_id;
    if (parentId && byId.has(parentId) && parentId !== entry.relationship_id) {
      children.set(parentId, [...(children.get(parentId) ?? []), entry]);
    }
  }

  const result: InventoryTreeEntry[] = [];
  const visited = new Set<string>();
  const append = (entry: ItemBridge, depth: number, active: Set<string>): void => {
    if (visited.has(entry.relationship_id) || active.has(entry.relationship_id)) {
      return;
    }
    visited.add(entry.relationship_id);
    const nextActive = new Set(active).add(entry.relationship_id);
    result.push({ bridge: entry, depth });
    for (const child of children.get(entry.relationship_id) ?? []) {
      append(child, depth + 1, nextActive);
    }
  };

  for (const entry of entries) {
    if (!entry.parent_container_id || !byId.has(entry.parent_container_id)) {
      append(entry, 0, new Set());
    }
  }
  for (const entry of entries) {
    append(entry, 0, new Set());
  }
  return result;
}

export function eligibleContainerDestinations(
  relationshipId: string,
  entries: ItemBridge[],
  items: Record<string, ItemDefinition>
): ItemBridge[] {
  const descendants = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const entry of entries) {
      if (
        entry.parent_container_id === relationshipId ||
        (entry.parent_container_id && descendants.has(entry.parent_container_id))
      ) {
        if (!descendants.has(entry.relationship_id)) {
          descendants.add(entry.relationship_id);
          changed = true;
        }
      }
    }
  }

  return entries
    .filter((entry) => {
      const definition = items[entry.item_id];
      return (
        entry.relationship_id !== relationshipId &&
        !descendants.has(entry.relationship_id) &&
        entry.count === 1 &&
        Boolean(definition?.can_contain_items)
      );
    })
    .sort((left, right) => {
      const leftName = items[left.item_id]?.name ?? left.item_id;
      const rightName = items[right.item_id]?.name ?? right.item_id;
      return (
        leftName.localeCompare(rightName) ||
        left.relationship_id.localeCompare(right.relationship_id)
      );
    });
}

export function formatWeight(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value);
}
