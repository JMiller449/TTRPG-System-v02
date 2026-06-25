import { useMemo } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import { selectSheetInstanceView } from "@/app/state/selectors";
import type { SheetInstanceView } from "@/domain/models";
import { Panel } from "@/shared/ui/Panel";
import { EmptyState } from "@/shared/ui/EmptyState";

export function SheetTabs(): JSX.Element {
  const {
    state,
    dispatch
  } = useAppStore();
  const { persistentSheetOrder } = state.serverState;
  const { activeSheetId } = state.uiState;

  const items = useMemo(
    () =>
      persistentSheetOrder
        .map((id) => selectSheetInstanceView(state, id))
        .filter((sheet): sheet is SheetInstanceView => Boolean(sheet)),
    [persistentSheetOrder, state]
  );

  return (
    <Panel title="Active Sheets (Quick Switch)">
      <div className="tab-row" role="tablist" aria-label="Active sheet instances">
        {items.length === 0 ? <EmptyState message="No active sheet instances." /> : null}
        {items.map((sheet) => (
          <button
            key={sheet.id}
            type="button"
            role="tab"
            aria-selected={sheet.id === activeSheetId}
            aria-label={`Switch to ${sheet.name}`}
            className={`tab ${sheet.id === activeSheetId ? "tab--active" : ""}`}
            onClick={() => dispatch({ type: "set_active_sheet_local", sheetId: sheet.id })}
          >
            {sheet.name}
          </button>
        ))}
      </div>
    </Panel>
  );
}
