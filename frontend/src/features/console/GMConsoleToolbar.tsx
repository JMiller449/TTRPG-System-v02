import { useAppStore } from "@/app/state/useAppStore";
import { GM_TOOLBAR_NAV_GROUPS } from "@/features/console/gmConsoleToolbarData";

export function GMConsoleToolbar(): JSX.Element {
  const { state, dispatch } = useAppStore();
  const { gmView } = state.uiState;

  return (
    <aside className="gm-toolbar app-nav-panel" aria-label="GM tools">
      <div className="gm-toolbar__controls">
        <nav className="gm-toolbar__nav" aria-label="GM pages">
          {GM_TOOLBAR_NAV_GROUPS.map((group) => (
            <section className="gm-toolbar__nav-group" key={group.label}>
              <p className="gm-toolbar__nav-group-label">{group.label}</p>
              {group.items.map((item) => (
                <button
                  key={item.view}
                  type="button"
                  className={`gm-toolbar__nav-button ${gmView === item.view ? "gm-toolbar__nav-button--active" : ""}`}
                  aria-current={gmView === item.view ? "page" : undefined}
                  onClick={() => {
                    if (item.view === "create_template") {
                      dispatch({ type: "set_template_builder_sheet", sheetId: null });
                    }
                    dispatch({ type: "set_gm_view", view: item.view });
                  }}
                >
                  <span className="gm-toolbar__nav-glyph" aria-hidden="true">
                    {item.glyph}
                  </span>
                  <span className="gm-toolbar__nav-label">{item.label}</span>
                  {gmView === item.view ? (
                    <span className="gm-toolbar__nav-active" aria-hidden="true" />
                  ) : null}
                </button>
              ))}
            </section>
          ))}
        </nav>
      </div>
    </aside>
  );
}
