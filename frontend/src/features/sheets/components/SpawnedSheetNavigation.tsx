import { useAppStore } from "@/app/state/useAppStore";
import { selectSheetInstanceView } from "@/app/state/selectors";
import type { SheetInstanceView } from "@/domain/models";
import { CatalogBrowser } from "@/features/catalogs/CatalogBrowser";
import { CatalogEntityPicker } from "@/features/catalogs/CatalogEntityPicker";
import type { GameClient } from "@/hooks/useGameClient";

function useSpawnedSheetNavigation() {
  const { state, dispatch } = useAppStore();
  const { activeSheetId } = state.uiState;
  const sheetOptions = state.serverState.persistentSheetOrder
    .map((id) => selectSheetInstanceView(state, id))
    .filter((sheet): sheet is SheetInstanceView => Boolean(sheet));
  const selectedSheetId = sheetOptions.some((sheet) => sheet.id === activeSheetId)
    ? activeSheetId
    : (sheetOptions[0]?.id ?? "");

  return {
    sheetOptions,
    selectedSheetId,
    selectSheet: (sheetId: string) =>
      dispatch({
        type: "set_active_sheet_local",
        sheetId
      })
  };
}

export function ActiveSheetNamePicker(): JSX.Element {
  const { sheetOptions, selectedSheetId, selectSheet } = useSpawnedSheetNavigation();

  return (
    <div className="active-sheet-name-picker">
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
        onSelect={selectSheet}
      />
    </div>
  );
}

export function SpawnedSheetOrganizer({ client }: { client: GameClient }): JSX.Element {
  const { sheetOptions, selectedSheetId, selectSheet } = useSpawnedSheetNavigation();

  return (
    <div className="spawned-sheet-organizer">
      <header className="sheet-detail-page__header">
        <div>
          <span>Character organization</span>
          <h3>Organize Spawned Sheets</h3>
        </div>
        <p className="muted">Arrange spawned sheets into display-only folders.</p>
      </header>
      <div className="spawned-sheet-organizer__browser">
        <CatalogBrowser
          catalog="sheet_instances"
          client={client}
          items={sheetOptions.map((sheet) => ({ id: sheet.id, name: sheet.name }))}
          selectedId={selectedSheetId || null}
          entityLabel="sheet"
          emptyMessage="No spawned sheets available."
          searchPlaceholder="Name or sheet ID"
          onSelect={selectSheet}
        />
      </div>
    </div>
  );
}
