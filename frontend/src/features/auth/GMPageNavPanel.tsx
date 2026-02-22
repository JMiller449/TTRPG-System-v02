import { useAppStore } from "@/app/state/store";
import type { GMView } from "@/app/state/types";
import { Panel } from "@/shared/ui/Panel";

const NAV_ITEMS: Array<{ view: GMView; label: string }> = [
  { view: "console", label: "GM Console" },
  { view: "template_library", label: "Template Library" },
  { view: "create_template", label: "Create Template" },
  { view: "encounter_presets", label: "Encounter Presets" }
];

export function GMPageNavPanel(): JSX.Element {
  const {
    state: { gmView },
    dispatch
  } = useAppStore();

  return (
    <Panel title="GM Navigation">
      <div className="stack">
        <div className="tab-row">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.view}
              className={`tab ${gmView === item.view ? "tab--active" : ""}`}
              onClick={() => dispatch({ type: "set_gm_view", view: item.view })}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="muted">Template and encounter management are available as separate pages.</p>
      </div>
    </Panel>
  );
}
