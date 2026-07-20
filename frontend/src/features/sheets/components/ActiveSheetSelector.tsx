import { useAppStore } from "@/app/state/useAppStore";
import { selectSheetInstanceView } from "@/app/state/selectors";
import type { SheetInstanceView } from "@/domain/models";
import type { GameClient } from "@/hooks/useGameClient";
import { buildDeleteInstancedSheetRequest } from "@/infrastructure/ws/requestBuilders";
import { confirmDestructiveAction } from "@/shared/ui/confirmDestructiveAction";

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
        <label className="sheet-context-selector__field">
          <span>Active spawned sheet</span>
          <select
            value={selectedSheetId ?? ""}
            disabled={sheetOptions.length === 0}
            onChange={(event) =>
              dispatch({
                type: "set_active_sheet_local",
                sheetId: event.target.value
              })
            }
          >
            {sheetOptions.length === 0 ? (
              <option value="">No spawned sheets available</option>
            ) : null}
            {sheetOptions.map((sheet) => (
              <option key={sheet.id} value={sheet.id}>
                {sheet.name}
              </option>
            ))}
          </select>
        </label>
        {client ? (
          <button
            type="button"
            className="button button--danger"
            onClick={despawnSelectedSheet}
            disabled={!selectedSheet}
          >
            Despawn
          </button>
        ) : null}
      </div>
    </section>
  );
}
