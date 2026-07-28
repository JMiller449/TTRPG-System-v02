import { useEffect, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import type { CatalogKey } from "@/domain/models";
import type { GameClient } from "@/hooks/useGameClient";
import { buildMoveCatalogNodeRequest } from "@/infrastructure/ws/requestBuilders";

export function useCatalogCreationTarget({
  catalog,
  client,
  entries
}: {
  catalog: CatalogKey;
  client: GameClient;
  entries: Record<string, unknown>;
}): {
  beginCreation: (folderId: string | null) => void;
  queueCreatedEntry: (entryId: string) => void;
} {
  const {
    state: {
      uiState: { catalogCreationTargets }
    },
    dispatch
  } = useAppStore();
  const creationFolderId = catalogCreationTargets[catalog] ?? null;
  const [pendingPlacement, setPendingPlacement] = useState<{
    entryId: string;
    folderId: string;
  } | null>(null);

  useEffect(() => {
    if (!pendingPlacement || !entries[pendingPlacement.entryId]) {
      return;
    }
    client.sendProtocolRequest(
      buildMoveCatalogNodeRequest({
        catalog,
        nodeType: "entry",
        nodeId: pendingPlacement.entryId,
        parentId: pendingPlacement.folderId
      }),
      "Place new catalog entry"
    );
    setPendingPlacement(null);
  }, [catalog, client, entries, pendingPlacement]);

  return {
    beginCreation: (folderId) =>
      dispatch({ type: "set_catalog_creation_target", catalog, folderId }),
    queueCreatedEntry: (entryId: string) => {
      if (creationFolderId) {
        setPendingPlacement({ entryId, folderId: creationFolderId });
      }
      dispatch({ type: "set_catalog_creation_target", catalog, folderId: null });
    }
  };
}
