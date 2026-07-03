import { useMemo, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
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

      <div className="gm-toolbar__controls" role="toolbar" aria-label="GM quick controls">
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

        <div className="gm-toolbar__secondary">
          <label className="gm-toolbar__field">
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
      </div>
    </aside>
  );
}
