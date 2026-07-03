import { useAppStore } from "@/app/state/useAppStore";
import { selectSheetInstanceView } from "@/app/state/selectors";
import type { SheetInstanceView } from "@/domain/models";

export function ActiveSheetSelector(): JSX.Element {
  const { state, dispatch } = useAppStore();
  const { activeSheetId } = state.uiState;
  const sheetOptions = state.serverState.persistentSheetOrder
    .map((id) => selectSheetInstanceView(state, id))
    .filter((sheet): sheet is SheetInstanceView => Boolean(sheet));

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
          value={activeSheetId ?? ""}
          onChange={(event) =>
            dispatch({
              type: "set_active_sheet_local",
              sheetId: event.target.value || null
            })
          }
        >
          <option value="">No active sheet</option>
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
