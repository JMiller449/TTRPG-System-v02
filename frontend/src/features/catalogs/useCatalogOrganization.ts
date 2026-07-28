import { useContext, useMemo } from "react";
import { AppStateContext, StoreContext } from "@/app/state/storeContext";
import type { CatalogKey } from "@/domain/models";
import type { SearchPopoverOrganization } from "@/shared/ui/searchPopover";

export function useCatalogOrganization(catalog: CatalogKey): SearchPopoverOrganization {
  const appState = useContext(AppStateContext);
  const legacyStore = useContext(StoreContext);
  const serverState = appState?.serverState ?? legacyStore?.state.serverState;

  return useMemo(
    () => ({
      folders: Object.values(serverState?.catalogFolders ?? {})
        .filter((folder) => folder.catalog === catalog)
        .map((folder) => ({
          id: folder.id,
          name: folder.name,
          parentId: folder.parent_id ?? null,
          position: folder.position
        })),
      placements: Object.values(serverState?.catalogEntries ?? {})
        .filter((entry) => entry.catalog === catalog)
        .map((entry) => ({
          entryId: entry.entry_id,
          folderId: entry.folder_id ?? null,
          position: entry.position
        }))
    }),
    [catalog, serverState]
  );
}
