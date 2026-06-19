import { useAppStore } from "@/app/state/useAppStore";
import type { GMView } from "@/app/state/types";
import { Panel } from "@/shared/ui/Panel";

const NAV_ITEMS: Array<{ view: GMView; label: string }> = [
  { view: "console", label: "GM Console" },
  { view: "sheet_viewer", label: "Sheet Viewer" },
  { view: "template_library", label: "Template Library" },
  { view: "create_template", label: "Create Template" },
  { view: "encounter_presets", label: "Encounter Presets" },
  { view: "item_maker", label: "Item Maker" },
  { view: "formula_authoring", label: "Formula Authoring" },
  { view: "condition_authoring", label: "Condition Authoring" },
  { view: "action_authoring", label: "Action Authoring" }
];

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
      </div>
    </Panel>
  );
}
