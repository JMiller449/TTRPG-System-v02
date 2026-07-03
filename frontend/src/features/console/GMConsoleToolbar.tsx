import { useMemo, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import type { GMView } from "@/app/state/types";
import { selectSheetInstanceView } from "@/app/state/selectors";
import type { SheetInstanceView } from "@/domain/models";
import {
  GM_TOOLBAR_NAV_ITEMS,
  orderedEncounterPresets
} from "@/features/console/gmConsoleToolbarData";
import { buildSpawnEncounterPresetSubmission } from "@/features/encounters/encounterRequests";
import type { GameClient } from "@/hooks/useGameClient";

export function GMConsoleToolbar({ client }: { client: GameClient }): JSX.Element {
  const { state, dispatch } = useAppStore();
  const { encounters, encounterOrder, persistentSheetOrder } = state.serverState;
  const { activeSheetId, connection, gmView, pendingIntentIds } = state.uiState;
  const [collapsed, setCollapsed] = useState(false);
  const [selectedEncounterId, setSelectedEncounterId] = useState("");

  const sheetOptions = useMemo(
    () =>
      persistentSheetOrder
        .map((id) => selectSheetInstanceView(state, id))
        .filter((sheet): sheet is SheetInstanceView => Boolean(sheet)),
    [persistentSheetOrder, state]
  );
  const encounterOptions = useMemo(
    () => orderedEncounterPresets(encounters, encounterOrder),
    [encounterOrder, encounters]
  );

  const spawnSelectedEncounter = (): void => {
    if (!selectedEncounterId) {
      return;
    }
    const submission = buildSpawnEncounterPresetSubmission(selectedEncounterId);
    client.sendProtocolRequest(submission.request, submission.label);
  };

  return (
    <aside className={`gm-toolbar ${collapsed ? "gm-toolbar--collapsed" : ""}`} aria-label="GM tools">
      <div className="gm-toolbar__header">
        <strong>GM Tools</strong>
        <div className="gm-toolbar__status" aria-label="Session status">
          <span className={`pill pill--${connection.status}`}>{connection.status}</span>
          <span className="pill">pending: {pendingIntentIds.length}</span>
        </div>
        <button
          className="gm-toolbar__collapse"
          type="button"
          aria-label={collapsed ? "Expand GM tools" : "Collapse GM tools"}
          aria-expanded={!collapsed}
          title={collapsed ? "Expand GM tools" : "Collapse GM tools"}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? "v" : "^"}
        </button>
      </div>

      {!collapsed ? (
        <div className="gm-toolbar__controls" role="toolbar" aria-label="GM quick controls">
          <label className="gm-toolbar__field">
            <span>Page</span>
            <select
              value={gmView}
              onChange={(event) => {
                const view = event.target.value as GMView;
                if (view === "create_template") {
                  dispatch({ type: "set_template_builder_sheet", sheetId: null });
                }
                dispatch({ type: "set_gm_view", view });
              }}
            >
              {GM_TOOLBAR_NAV_ITEMS.map((item) => (
                <option key={item.view} value={item.view}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="gm-toolbar__field">
            <span>Active Sheet</span>
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

          <label className="gm-toolbar__field gm-toolbar__field--encounter">
            <span>Encounter</span>
            <select
              value={selectedEncounterId}
              onChange={(event) => setSelectedEncounterId(event.target.value)}
            >
              <option value="">Select preset</option>
              {encounterOptions.map((encounter) => (
                <option key={encounter.id} value={encounter.id}>
                  {encounter.name}
                </option>
              ))}
            </select>
          </label>

          <button
            className="button gm-toolbar__spawn"
            type="button"
            disabled={!selectedEncounterId}
            onClick={spawnSelectedEncounter}
          >
            Spawn
          </button>
        </div>
      ) : null}
    </aside>
  );
}
