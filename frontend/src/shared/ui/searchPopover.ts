export interface SearchPopoverOption<T> {
  id: string;
  label: string;
  secondary?: string;
  keywords?: string[];
  disabledReason?: string;
  organizationEntryId?: string;
  value: T;
}

export interface SearchPopoverFolder {
  id: string;
  name: string;
  parentId: string | null;
  position: number;
}

export interface SearchPopoverPlacement {
  entryId: string;
  folderId: string | null;
  position: number;
}

export interface SearchPopoverOrganization {
  folders: SearchPopoverFolder[];
  placements: SearchPopoverPlacement[];
}

export type SearchPopoverRow<T> =
  | {
      type: "folder";
      id: string;
      name: string;
      depth: number;
      expanded: boolean;
    }
  | {
      type: "option";
      option: SearchPopoverOption<T>;
      depth: number;
    };

export function filterSearchPopoverOptions<T>(
  options: SearchPopoverOption<T>[],
  query: string
): SearchPopoverOption<T>[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return options;
  }
  return options.filter((option) =>
    [option.label, option.secondary ?? "", ...(option.keywords ?? [])]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery)
  );
}

export function buildOrganizedSearchPopoverRows<T>({
  options,
  organization,
  query,
  collapsedFolderIds
}: {
  options: SearchPopoverOption<T>[];
  organization?: SearchPopoverOrganization;
  query: string;
  collapsedFolderIds: ReadonlySet<string>;
}): SearchPopoverRow<T>[] {
  if (!organization) {
    return filterSearchPopoverOptions(options, query).map((option) => ({
      type: "option",
      option,
      depth: 0
    }));
  }

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const folderById = new Map(organization.folders.map((folder) => [folder.id, folder]));
  const placementByEntryId = new Map(
    organization.placements.map((placement) => [placement.entryId, placement])
  );
  const folderPath = (folderId: string | null): string[] => {
    const names: string[] = [];
    const visited = new Set<string>();
    let currentId = folderId;
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const folder = folderById.get(currentId);
      if (!folder) {
        break;
      }
      names.unshift(folder.name);
      currentId = folder.parentId;
    }
    return names;
  };
  const visibleOptions = options.filter((option) => {
    if (!normalizedQuery) {
      return true;
    }
    const entryId = option.organizationEntryId ?? option.id;
    const placement = placementByEntryId.get(entryId);
    return [
      option.label,
      option.secondary ?? "",
      ...(option.keywords ?? []),
      ...folderPath(placement?.folderId ?? null)
    ]
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalizedQuery);
  });
  const optionsByFolder = new Map<string | null, SearchPopoverOption<T>[]>();
  for (const option of visibleOptions) {
    const entryId = option.organizationEntryId ?? option.id;
    const folderId = placementByEntryId.get(entryId)?.folderId ?? null;
    const validFolderId = folderId && folderById.has(folderId) ? folderId : null;
    const siblings = optionsByFolder.get(validFolderId) ?? [];
    siblings.push(option);
    optionsByFolder.set(validFolderId, siblings);
  }
  const childrenByParent = new Map<string | null, SearchPopoverFolder[]>();
  for (const folder of organization.folders) {
    const parentId = folder.parentId && folderById.has(folder.parentId) ? folder.parentId : null;
    const siblings = childrenByParent.get(parentId) ?? [];
    siblings.push(folder);
    childrenByParent.set(parentId, siblings);
  }
  const branchHasOptions = (folderId: string): boolean =>
    Boolean(optionsByFolder.get(folderId)?.length) ||
    (childrenByParent.get(folderId) ?? []).some((folder) => branchHasOptions(folder.id));
  const optionOrder = new Map(options.map((option, index) => [option.id, index]));
  const rows: SearchPopoverRow<T>[] = [];

  const appendLevel = (parentId: string | null, depth: number): void => {
    const nodes: Array<
      | { type: "folder"; folder: SearchPopoverFolder; position: number }
      | { type: "option"; option: SearchPopoverOption<T>; position: number }
    > = (childrenByParent.get(parentId) ?? [])
      .filter((folder) => branchHasOptions(folder.id))
      .map((folder) => ({ type: "folder", folder, position: folder.position }));
    nodes.push(
      ...(optionsByFolder.get(parentId) ?? []).map((option) => {
        const entryId = option.organizationEntryId ?? option.id;
        return {
          type: "option" as const,
          option,
          position:
            placementByEntryId.get(entryId)?.position ??
            (optionOrder.get(option.id) ?? options.length) + 100_000
        };
      })
    );
    nodes.sort((left, right) => left.position - right.position);

    for (const node of nodes) {
      if (node.type === "option") {
        rows.push({ type: "option", option: node.option, depth });
        continue;
      }
      const expanded = Boolean(normalizedQuery) || !collapsedFolderIds.has(node.folder.id);
      rows.push({
        type: "folder",
        id: node.folder.id,
        name: node.folder.name,
        depth,
        expanded
      });
      if (expanded) {
        appendLevel(node.folder.id, depth + 1);
      }
    }
  };

  appendLevel(null, 0);
  return rows;
}

export function nextEnabledOptionIndex<T>({
  options,
  currentIndex,
  direction
}: {
  options: SearchPopoverOption<T>[];
  currentIndex: number;
  direction: "next" | "previous" | "first" | "last";
}): number {
  if (options.length === 0) {
    return -1;
  }
  const enabledIndexes = options
    .map((option, index) => (option.disabledReason ? -1 : index))
    .filter((index) => index >= 0);
  if (enabledIndexes.length === 0) {
    return -1;
  }
  if (direction === "first") {
    return enabledIndexes[0] ?? -1;
  }
  if (direction === "last") {
    return enabledIndexes.at(-1) ?? -1;
  }
  if (direction === "next") {
    return enabledIndexes.find((index) => index > currentIndex) ?? enabledIndexes[0] ?? -1;
  }
  return (
    [...enabledIndexes].reverse().find((index) => index < currentIndex) ??
    enabledIndexes.at(-1) ??
    -1
  );
}

export interface SearchPopoverPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

export function calculateSearchPopoverPosition({
  anchor,
  viewportWidth,
  viewportHeight
}: {
  anchor: Pick<DOMRect, "top" | "right" | "bottom" | "left" | "width">;
  viewportWidth: number;
  viewportHeight: number;
}): SearchPopoverPosition {
  const margin = 8;
  const gap = 4;
  const below = viewportHeight - anchor.bottom - gap - margin;
  const above = anchor.top - gap - margin;
  const placeAbove = below < 160 && above > below;
  const availableHeight = placeAbove ? above : below;
  const maxHeight = Math.max(80, Math.min(320, availableHeight));
  const width = Math.min(Math.max(anchor.width, 320), viewportWidth - margin * 2);
  const left = Math.min(Math.max(margin, anchor.left), viewportWidth - width - margin);
  const top = placeAbove
    ? Math.max(margin, anchor.top - gap - maxHeight)
    : Math.min(viewportHeight - margin, anchor.bottom + gap);
  return { top, left, width, maxHeight };
}
