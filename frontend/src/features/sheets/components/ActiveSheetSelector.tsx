import { useAppStore } from "@/app/state/useAppStore";
import { selectSheetInstanceView } from "@/app/state/selectors";
import type { SheetInstanceView } from "@/domain/models";

export function ActiveSheetSelector(): JSX.Element {
  const { state, dispatch } = useAppStore();
  const { activeSheetId } = state.uiState;
  const sheetOptions = state.serverState.persistentSheetOrder
    .map((id) => selectSheetInstanceView(state, id))
    .filter((sheet): sheet is SheetInstanceView => Boolean(sheet));
  const selectedSheetId = sheetOptions.some((sheet) => sheet.id === activeSheetId)
    ? activeSheetId
    : (sheetOptions[0]?.id ?? "");

  return (
    <section className="sheet-context-selector" aria-label="Active sheet context">
      <div>
        <p className="sheet-context-selector__eyebrow">Sheet Context</p>
        <p className="sheet-context-selector__description">
          Choose the sheet instance used by this workspace.
        </p>
      </div>
      <label className="sheet-context-selector__field">
        <span>Active sheet</span>
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
          {sheetOptions.length === 0 ? <option value="">No sheets available</option> : null}
          {sheetOptions.map((sheet) => (
            <option key={sheet.id} value={sheet.id}>
              {sheet.name}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
