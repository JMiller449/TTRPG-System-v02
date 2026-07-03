import { useAppStore } from "@/app/state/useAppStore";
import { GM_TOOLBAR_NAV_ITEMS } from "@/features/console/gmConsoleToolbarData";

export function GMConsoleToolbar(): JSX.Element {
  const { state, dispatch } = useAppStore();
  const { connection, gmView, pendingIntentIds } = state.uiState;

  return (
    <aside className="gm-toolbar app-nav-panel" aria-label="GM tools">
      <div className="gm-toolbar__header">
        <div>
          <p className="nav-panel__eyebrow">Session Control</p>
          <strong className="nav-panel__title">GM Tools</strong>
        </div>
        <div className="gm-toolbar__status" aria-label="Session status">
          <span className={`system-status system-status--${connection.status}`}>
            <span aria-hidden="true" />
            {connection.status}
          </span>
          <span className="system-status">
            <span aria-hidden="true" />
            Pending {pendingIntentIds.length}
          </span>
        </div>
      </div>

      <div className="gm-toolbar__controls">
        <nav className="gm-toolbar__nav" aria-label="GM pages">
          {GM_TOOLBAR_NAV_ITEMS.map((item) => (
            <button
              key={item.view}
              type="button"
              className={`gm-toolbar__nav-button ${gmView === item.view ? "gm-toolbar__nav-button--active" : ""}`}
              onClick={() => {
                if (item.view === "create_template") {
                  dispatch({ type: "set_template_builder_sheet", sheetId: null });
                }
                dispatch({ type: "set_gm_view", view: item.view });
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </aside>
  );
}
