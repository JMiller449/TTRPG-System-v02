import { useEffect, useMemo, useRef, useState } from "react";
import type { CatalogKey } from "@/domain/models";
import { useCatalogOrganization } from "@/features/catalogs/useCatalogOrganization";
import {
  buildOrganizedSearchPopoverRows,
  type SearchPopoverOption
} from "@/shared/ui/searchPopover";

export interface CatalogEntityMultiSelectOption {
  id: string;
  label: string;
  secondary?: string;
  keywords?: string[];
}

function SelectionCheckbox({
  checked,
  indeterminate = false,
  label,
  onChange
}: {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={inputRef}
      type="checkbox"
      checked={checked}
      aria-label={label}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}

export function CatalogEntityMultiSelect({
  catalog,
  label,
  options,
  selectedIds,
  onChange,
  emptyMessage = "No options are available.",
  noResultsMessage = "No options match this search.",
  selectionAriaLabel = (optionLabel) => `Allow ${optionLabel}`,
  folderSelectionAriaLabel = (folderName) => `Allow all players in ${folderName}`
}: {
  catalog: CatalogKey;
  label: string;
  options: CatalogEntityMultiSelectOption[];
  selectedIds: readonly string[];
  onChange: (selectedIds: string[]) => void;
  emptyMessage?: string;
  noResultsMessage?: string;
  selectionAriaLabel?: (optionLabel: string) => string;
  folderSelectionAriaLabel?: (folderName: string) => string;
}): JSX.Element {
  const organization = useCatalogOrganization(catalog);
  const [query, setQuery] = useState("");
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(() => new Set());
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const collapsedFolderIds = useMemo(
    () =>
      new Set(
        organization.folders
          .map((folder) => folder.id)
          .filter((folderId) => !expandedFolderIds.has(folderId))
      ),
    [expandedFolderIds, organization.folders]
  );
  const pickerOptions = useMemo<SearchPopoverOption<string>[]>(
    () =>
      options.map((option) => ({
        ...option,
        value: option.id
      })),
    [options]
  );
  const rows = useMemo(
    () =>
      buildOrganizedSearchPopoverRows({
        options: pickerOptions,
        organization,
        query,
        collapsedFolderIds
      }),
    [collapsedFolderIds, organization, pickerOptions, query]
  );
  const descendantIdsByFolder = useMemo(() => {
    const folderById = new Map(organization.folders.map((folder) => [folder.id, folder]));
    const childrenByParent = new Map<string | null, string[]>();
    for (const folder of organization.folders) {
      const parentId =
        folder.parentId && folderById.has(folder.parentId) ? folder.parentId : null;
      childrenByParent.set(parentId, [
        ...(childrenByParent.get(parentId) ?? []),
        folder.id
      ]);
    }
    const placementByEntryId = new Map(
      organization.placements.map((placement) => [placement.entryId, placement])
    );
    const directIdsByFolder = new Map<string, string[]>();
    for (const option of options) {
      const folderId = placementByEntryId.get(option.id)?.folderId;
      if (!folderId || !folderById.has(folderId)) {
        continue;
      }
      directIdsByFolder.set(folderId, [
        ...(directIdsByFolder.get(folderId) ?? []),
        option.id
      ]);
    }
    const result = new Map<string, string[]>();
    const collect = (folderId: string, visited: Set<string>): string[] => {
      if (visited.has(folderId)) {
        return [];
      }
      const nextVisited = new Set(visited).add(folderId);
      const ids = [
        ...(directIdsByFolder.get(folderId) ?? []),
        ...(childrenByParent.get(folderId) ?? []).flatMap((childId) =>
          collect(childId, nextVisited)
        )
      ];
      result.set(folderId, ids);
      return ids;
    };
    for (const folder of organization.folders) {
      collect(folder.id, new Set());
    }
    return result;
  }, [options, organization]);

  const setEntitySelected = (entityId: string, selected: boolean): void => {
    const next = new Set(selectedIds);
    if (selected) {
      next.add(entityId);
    } else {
      next.delete(entityId);
    }
    onChange(options.map((option) => option.id).filter((id) => next.has(id)));
  };

  const setFolderSelected = (folderId: string, selected: boolean): void => {
    const next = new Set(selectedIds);
    for (const entityId of descendantIdsByFolder.get(folderId) ?? []) {
      if (selected) {
        next.add(entityId);
      } else {
        next.delete(entityId);
      }
    }
    onChange(options.map((option) => option.id).filter((id) => next.has(id)));
  };

  return (
    <section className="catalog-multi-select" aria-label={label}>
      <div className="catalog-multi-select__heading">
        <strong>{label}</strong>
        <span className="muted">
          {selectedIds.length} of {options.length} selected
        </span>
      </div>
      <input
        className="catalog-multi-select__search"
        type="search"
        value={query}
        aria-label={`Search ${label}`}
        placeholder="Search by name, ID, or folder"
        onChange={(event) => setQuery(event.target.value)}
      />
      {options.length === 0 ? (
        <p className="muted">{emptyMessage}</p>
      ) : rows.length === 0 ? (
        <p className="muted">{noResultsMessage}</p>
      ) : (
        <ul className="catalog-multi-select__tree">
          {rows.map((row) => {
            if (row.type === "option") {
              const option = row.option;
              return (
                <li
                  className="catalog-multi-select__entity"
                  key={`entity:${option.id}`}
                  style={{ paddingInlineStart: `${0.6 + row.depth * 1.1}rem` }}
                >
                  <label>
                    <SelectionCheckbox
                      checked={selectedIdSet.has(option.id)}
                      label={selectionAriaLabel(option.label)}
                      onChange={(selected) => setEntitySelected(option.id, selected)}
                    />
                    <span>
                      <strong>{option.label}</strong>
                      {option.secondary ? <small>{option.secondary}</small> : null}
                    </span>
                  </label>
                </li>
              );
            }
            const descendantIds = descendantIdsByFolder.get(row.id) ?? [];
            const selectedCount = descendantIds.filter((id) => selectedIdSet.has(id)).length;
            return (
              <li
                className="catalog-multi-select__folder"
                key={`folder:${row.id}`}
                style={{ paddingInlineStart: `${0.35 + row.depth * 1.1}rem` }}
              >
                <button
                  type="button"
                  aria-label={`${row.expanded ? "Collapse" : "Expand"} ${row.name}`}
                  aria-expanded={row.expanded}
                  onClick={() =>
                    setExpandedFolderIds((current) => {
                      const next = new Set(current);
                      if (next.has(row.id)) {
                        next.delete(row.id);
                      } else {
                        next.add(row.id);
                      }
                      return next;
                    })
                  }
                >
                  <span aria-hidden="true">{row.expanded ? "▾" : "▸"}</span>
                </button>
                <SelectionCheckbox
                  checked={descendantIds.length > 0 && selectedCount === descendantIds.length}
                  indeterminate={selectedCount > 0 && selectedCount < descendantIds.length}
                  label={folderSelectionAriaLabel(row.name)}
                  onChange={(selected) => setFolderSelected(row.id, selected)}
                />
                <strong>{row.name}</strong>
                <small className="muted">
                  {selectedCount}/{descendantIds.length}
                </small>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
