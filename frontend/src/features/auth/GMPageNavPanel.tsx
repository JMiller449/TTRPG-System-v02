import { useAppStore } from "@/app/state/useAppStore";
import { GM_NAV_ITEMS } from "@/features/console/gmNavigation";
import { Panel } from "@/shared/ui/Panel";

export function GMPageNavPanel(): JSX.Element {
  const {
    state: {
      uiState: { gmView }
    },
    dispatch
  } = useAppStore();

  return (
    <Panel title="GM Navigation">
      <div className="stack">
        <div className="tab-row">
          {GM_NAV_ITEMS.map((item) => (
            <button
              key={item.view}
              className={`tab ${gmView === item.view ? "tab--active" : ""}`}
              onClick={() => dispatch({ type: "set_gm_view", view: item.view })}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </Panel>
  );
}
