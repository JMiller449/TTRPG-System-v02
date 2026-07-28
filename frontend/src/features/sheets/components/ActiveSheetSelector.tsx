import { useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import { selectSheetInstanceView } from "@/app/state/selectors";
import type { SheetInstanceView } from "@/domain/models";
import type { GameClient } from "@/hooks/useGameClient";
import { buildDeleteInstancedSheetRequest } from "@/infrastructure/ws/requestBuilders";
import { confirmDestructiveAction } from "@/shared/ui/confirmDestructiveAction";
import { CatalogBrowser } from "@/features/catalogs/CatalogBrowser";
import { CatalogEntityPicker } from "@/features/catalogs/CatalogEntityPicker";
import { ModalDialog } from "@/shared/ui/ModalDialog";

export function ActiveSheetSelector({ client }: { client?: GameClient }): JSX.Element {
  const { state, dispatch } = useAppStore();
  const { activeSheetId } = state.uiState;
  const sheetOptions = state.serverState.persistentSheetOrder
    .map((id) => selectSheetInstanceView(state, id))
    .filter((sheet): sheet is SheetInstanceView => Boolean(sheet));
  const selectedSheetId = sheetOptions.some((sheet) => sheet.id === activeSheetId)
    ? activeSheetId
    : (sheetOptions[0]?.id ?? "");
  const selectedSheet = sheetOptions.find((sheet) => sheet.id === selectedSheetId) ?? null;
  const [organizerOpen, setOrganizerOpen] = useState(false);

  const despawnSelectedSheet = (): void => {
    if (!client || !selectedSheet) {
      return;
    }
    if (
      !confirmDestructiveAction({
        action: "Despawn",
        subject: selectedSheet.name,
        consequence:
          "This permanently removes the spawned character and its current inventory, assignments, and runtime state."
      })
    ) {
      return;
    }
    client.sendProtocolRequest(
      buildDeleteInstancedSheetRequest({ instanceId: selectedSheet.id }),
      `Despawn ${selectedSheet.name}`
    );
  };

  return (
    <section className="sheet-context-selector" aria-label="Active spawned sheet context">
      <div>
        <p className="sheet-context-selector__eyebrow">Spawned Sheet Context</p>
        <p className="sheet-context-selector__description">
          Choose the spawned sheet instance used by this workspace.
        </p>
      </div>
      <div className="sheet-context-selector__controls">
        <div className="sheet-context-selector__field">
          <CatalogEntityPicker
            catalog="sheet_instances"
            label="Active spawned sheet"
            placeholder={
              sheetOptions.length === 0 ? "No spawned sheets available" : "Search spawned sheets"
            }
            selectedId={selectedSheetId}
            disabled={sheetOptions.length === 0}
            options={sheetOptions.map((sheet) => ({
              id: sheet.id,
              label: sheet.name,
              value: sheet.id
            }))}
            emptyMessage="No spawned sheets available."
            onSelect={(sheetId) =>
              dispatch({
                type: "set_active_sheet_local",
                sheetId
              })
            }
          />
        </div>
        {client ? (
          <>
            <button
              type="button"
              className="button button--secondary"
              aria-haspopup="dialog"
              aria-expanded={organizerOpen}
              onClick={() => setOrganizerOpen(true)}
            >
              Organize Sheets
            </button>
            <button
              type="button"
              className="button button--danger"
              onClick={despawnSelectedSheet}
              disabled={!selectedSheet}
            >
              Despawn
            </button>
          </>
        ) : null}
      </div>
      {client && organizerOpen ? (
        <ModalDialog
          title="Organize spawned sheets"
          description="Arrange spawned sheets into display-only folders."
          onClose={() => setOrganizerOpen(false)}
        >
          <CatalogBrowser
            catalog="sheet_instances"
            client={client}
            items={sheetOptions.map((sheet) => ({ id: sheet.id, name: sheet.name }))}
            selectedId={selectedSheetId}
            entityLabel="sheet"
            emptyMessage="No spawned sheets available."
            onSelect={(sheetId) =>
              dispatch({
                type: "set_active_sheet_local",
                sheetId
              })
            }
          />
        </ModalDialog>
      ) : null}
    </section>
  );
}
