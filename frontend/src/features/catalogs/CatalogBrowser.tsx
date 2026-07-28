import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import type { CatalogFolder, CatalogKey } from "@/domain/models";
import type { GameClient } from "@/hooks/useGameClient";
import {
  buildCreateCatalogFolderRequest,
  buildDeleteCatalogFolderRequest,
  buildMoveCatalogNodeRequest,
  buildRenameCatalogFolderRequest
} from "@/infrastructure/ws/requestBuilders";
import { confirmDestructiveAction } from "@/shared/ui/confirmDestructiveAction";
import { ModalDialog } from "@/shared/ui/ModalDialog";
import { makeId } from "@/shared/utils/id";

export interface CatalogBrowserItem {
  id: string;
  name: string;
  searchText?: string;
  disabled?: boolean;
  disabledReason?: string;
}

interface DraggedCatalogNode {
  nodeType: "folder" | "entry";
  nodeId: string;
}

const DRAG_TYPE = "application/x-ttrpg-catalog-node";

function readDraggedNode(event: React.DragEvent): DraggedCatalogNode | null {
  try {
    const parsed = JSON.parse(event.dataTransfer.getData(DRAG_TYPE)) as DraggedCatalogNode;
    return parsed.nodeType === "folder" || parsed.nodeType === "entry" ? parsed : null;
  } catch {
    return null;
  }
}

export function CatalogBrowser({
  catalog,
  client,
  items,
  selectedId,
  entityLabel,
  emptyMessage,
  searchPlaceholder,
  onSelect,
  onCreateEntry,
  renderEntry
}: {
  catalog: CatalogKey;
  client: GameClient;
  items: readonly CatalogBrowserItem[];
  selectedId: string | null;
  entityLabel: string;
  emptyMessage: string;
  searchPlaceholder?: string;
  onSelect: (id: string) => void;
  onCreateEntry?: (folderId: string | null) => void;
  renderEntry?: (item: CatalogBrowserItem) => ReactNode;
}): JSX.Element {
  const {
    state: {
      serverState: { catalogFolders, catalogEntries }
    }
  } = useAppStore();
  const [query, setQuery] = useState("");
  const [creatingUnder, setCreatingUnder] = useState<string | null | undefined>(undefined);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(() => new Set());
  const closeFolderDialog = useCallback(() => {
    setCreatingUnder(undefined);
    setNewFolderName("");
  }, []);

  const folders = useMemo(
    () =>
      Object.values(catalogFolders)
        .filter((folder) => folder.catalog === catalog)
        .sort((left, right) => left.position - right.position),
    [catalog, catalogFolders]
  );
  const placements = useMemo(
    () =>
      Object.values(catalogEntries).filter(
        (entry) => entry.catalog === catalog && items.some((item) => item.id === entry.entry_id)
      ),
    [catalog, catalogEntries, items]
  );
  const placementByEntryId = useMemo(
    () => new Map(placements.map((entry) => [entry.entry_id, entry])),
    [placements]
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleItemIds = useMemo(
    () =>
      new Set(
        items
          .filter((item) =>
            normalizedQuery
              ? `${item.name} ${item.id} ${item.searchText ?? ""}`
                  .toLocaleLowerCase()
                  .includes(normalizedQuery)
              : true
          )
          .map((item) => item.id)
      ),
    [items, normalizedQuery]
  );

  const childFolders = (parentId: string | null): CatalogFolder[] =>
    folders.filter((folder) => (folder.parent_id ?? null) === parentId);
  const childEntries = (folderId: string | null): CatalogBrowserItem[] =>
    items
      .filter((item) => (placementByEntryId.get(item.id)?.folder_id ?? null) === folderId)
      .filter((item) => visibleItemIds.has(item.id))
      .sort((left, right) => {
        const leftPosition =
          placementByEntryId.get(left.id)?.position ?? items.indexOf(left) + 100_000;
        const rightPosition =
          placementByEntryId.get(right.id)?.position ?? items.indexOf(right) + 100_000;
        return leftPosition - rightPosition;
      });

  const folderContainsMatch = (folderId: string): boolean =>
    childEntries(folderId).length > 0 ||
    childFolders(folderId).some(
      (folder) =>
        folder.name.toLocaleLowerCase().includes(normalizedQuery) || folderContainsMatch(folder.id)
    );

  const sendMove = (node: DraggedCatalogNode, parentId: string | null, position?: number): void => {
    client.sendProtocolRequest(
      buildMoveCatalogNodeRequest({
        catalog,
        nodeType: node.nodeType,
        nodeId: node.nodeId,
        parentId,
        position
      }),
      `Move ${node.nodeType === "folder" ? "folder" : entityLabel}`
    );
  };

  const dropInto = (event: React.DragEvent, parentId: string | null): void => {
    event.preventDefault();
    const node = readDraggedNode(event);
    if (node) {
      sendMove(node, parentId);
    }
  };

  const submitFolder = (): void => {
    const name = newFolderName.trim();
    if (!name || creatingUnder === undefined) {
      return;
    }
    client.sendProtocolRequest(
      buildCreateCatalogFolderRequest({
        folderId: makeId("catalog_folder"),
        catalog,
        name,
        parentId: creatingUnder
      }),
      `Create folder: ${name}`
    );
    closeFolderDialog();
  };

  const beginRename = (folder: CatalogFolder): void => {
    setRenamingFolderId(folder.id);
    setRenameValue(folder.name);
  };

  const submitRename = (folder: CatalogFolder): void => {
    const name = renameValue.trim();
    if (!name || name === folder.name) {
      setRenamingFolderId(null);
      return;
    }
    client.sendProtocolRequest(
      buildRenameCatalogFolderRequest({ folderId: folder.id, name }),
      `Rename folder: ${folder.name}`
    );
    setRenamingFolderId(null);
  };

  const deleteFolder = (folder: CatalogFolder): void => {
    if (
      !confirmDestructiveAction({
        action: "Delete",
        subject: folder.name,
        consequence:
          "This deletes only the display folder. Its entries and subfolders move up one level."
      })
    ) {
      return;
    }
    client.sendProtocolRequest(
      buildDeleteCatalogFolderRequest({ folderId: folder.id }),
      `Delete folder: ${folder.name}`
    );
  };

  const dragStart = (event: React.DragEvent, node: DraggedCatalogNode): void => {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(node));
  };

  const renderEntryNode = (item: CatalogBrowserItem, folderId: string | null): ReactNode => {
    const placement = placementByEntryId.get(item.id);
    return (
      <div
        className={`catalog-browser__entry ${
          selectedId === item.id ? "catalog-browser__entry--selected" : ""
        }`}
        draggable={!item.disabled}
        key={item.id}
        onDragStart={(event) =>
          dragStart(event, {
            nodeType: "entry",
            nodeId: item.id
          })
        }
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const node = readDraggedNode(event);
          if (node) {
            sendMove(node, folderId, placement?.position);
          }
        }}
      >
        {renderEntry ? (
          renderEntry(item)
        ) : (
          <button
            type="button"
            aria-pressed={selectedId === item.id}
            disabled={item.disabled}
            title={item.disabledReason ?? item.name}
            onClick={() => onSelect(item.id)}
          >
            {item.name}
          </button>
        )}
      </div>
    );
  };

  const renderAddMenu = (parentId: string | null): ReactNode => (
    <details className="catalog-browser__add-menu">
      <summary aria-label={`Add to ${parentId ? "folder" : "catalog root"}`}>+</summary>
      <div>
        {onCreateEntry ? (
          <button
            type="button"
            onClick={(event) => {
              event.currentTarget.closest("details")?.removeAttribute("open");
              onCreateEntry(parentId);
            }}
          >
            New {entityLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={(event) => {
            event.currentTarget.closest("details")?.removeAttribute("open");
            setCreatingUnder(parentId);
            setNewFolderName("");
          }}
        >
          New folder
        </button>
      </div>
    </details>
  );

  const renderFolder = (folder: CatalogFolder, depth: number): ReactNode => {
    if (
      normalizedQuery &&
      !folder.name.toLocaleLowerCase().includes(normalizedQuery) &&
      !folderContainsMatch(folder.id)
    ) {
      return null;
    }
    const entries = childEntries(folder.id);
    const collapsed = collapsedFolderIds.has(folder.id) && !normalizedQuery;
    return (
      <li
        className="catalog-browser__folder"
        key={folder.id}
        draggable
        onDragStart={(event) =>
          dragStart(event, {
            nodeType: "folder",
            nodeId: folder.id
          })
        }
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.stopPropagation();
          dropInto(event, folder.id);
        }}
      >
        <div className="catalog-browser__folder-row" style={{ paddingInlineStart: `${depth}rem` }}>
          {renamingFolderId === folder.id ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                submitRename(folder);
              }}
            >
              <input
                aria-label={`Rename ${folder.name}`}
                autoFocus
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
              />
            </form>
          ) : (
            <button
              type="button"
              className="catalog-browser__folder-toggle"
              aria-expanded={!collapsed}
              onClick={() =>
                setCollapsedFolderIds((current) => {
                  const next = new Set(current);
                  if (next.has(folder.id)) {
                    next.delete(folder.id);
                  } else {
                    next.add(folder.id);
                  }
                  return next;
                })
              }
            >
              <span aria-hidden="true">{collapsed ? "▸" : "▾"}</span>
              <strong>{folder.name}</strong>
            </button>
          )}
          <div className="catalog-browser__folder-actions">
            {renderAddMenu(folder.id)}
            <button
              type="button"
              aria-label={`Rename folder ${folder.name}`}
              onClick={() => beginRename(folder)}
            >
              Rename
            </button>
            <button
              type="button"
              aria-label={`Delete folder ${folder.name}`}
              onClick={() => deleteFolder(folder)}
            >
              Delete
            </button>
          </div>
        </div>
        {!collapsed ? (
          <ul>
            {childFolders(folder.id).map((child) => renderFolder(child, depth + 1))}
            {entries.map((item) => renderEntryNode(item, folder.id))}
          </ul>
        ) : null}
      </li>
    );
  };

  const rootEntries = childEntries(null);
  const noMatches =
    rootEntries.length === 0 &&
    !folders.some(
      (folder) =>
        (folder.parent_id ?? null) === null &&
        (!normalizedQuery ||
          folder.name.toLocaleLowerCase().includes(normalizedQuery) ||
          folderContainsMatch(folder.id))
    );

  return (
    <div className="catalog-browser">
      <label className="catalog-browser__search">
        <span>Search</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder ?? `Name or ${entityLabel} ID`}
        />
      </label>
      <div
        className="catalog-browser__root-row"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => dropInto(event, null)}
      >
        <strong>Catalog root</strong>
        {renderAddMenu(null)}
      </div>
      {noMatches ? (
        <p className="muted">{normalizedQuery ? "No matching entries." : emptyMessage}</p>
      ) : null}
      <ul className="catalog-browser__tree">
        {childFolders(null).map((folder) => renderFolder(folder, 0))}
        {rootEntries.map((item) => renderEntryNode(item, null))}
      </ul>
      {creatingUnder !== undefined ? (
        <ModalDialog
          title="Create folder"
          description={
            creatingUnder === null
              ? "Add a display folder at the catalog root."
              : `Add a display folder inside “${
                  catalogFolders[creatingUnder]?.name ?? "selected folder"
                }”.`
          }
          onClose={closeFolderDialog}
        >
          <form
            className="catalog-browser__folder-dialog-form"
            onSubmit={(event) => {
              event.preventDefault();
              submitFolder();
            }}
          >
            <label>
              <span>Folder name</span>
              <input
                aria-label="Folder name"
                autoFocus
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                placeholder="Folder name"
              />
            </label>
            <div className="catalog-browser__folder-dialog-actions">
              <button
                type="button"
                className="button button--secondary"
                onClick={closeFolderDialog}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="button button--primary"
                disabled={!newFolderName.trim()}
              >
                Create folder
              </button>
            </div>
          </form>
        </ModalDialog>
      ) : null}
    </div>
  );
}
