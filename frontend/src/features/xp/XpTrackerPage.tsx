import { useEffect, useMemo, useRef } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import { XpNumberEditor } from "@/features/xp/XpNumberEditor";
import type { GameClient } from "@/hooks/useGameClient";
import {
  buildGetXpTrackerRequest,
  buildSetMobXpValueRequest,
  buildSetSheetXpRequiredRequest
} from "@/infrastructure/ws/requestBuilders";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Panel } from "@/shared/ui/Panel";

export function XpTrackerPage({ client }: { client: GameClient }): JSX.Element {
  const { state } = useAppStore();
  const { sheets, sheetOrder } = state.serverState;
  const { xpTracker } = state.uiState;
  const requestedTrackerRef = useRef(false);

  useEffect(() => {
    if (requestedTrackerRef.current) {
      return;
    }
    requestedTrackerRef.current = true;
    client.sendProtocolRequest(buildGetXpTrackerRequest(), "Load XP tracker");
  }, [client]);

  const playerSheets = useMemo(
    () => sheetOrder.map((id) => sheets[id]).filter((sheet) => sheet && !sheet.dm_only),
    [sheetOrder, sheets]
  );
  const mobSheets = useMemo(
    () => sheetOrder.map((id) => sheets[id]).filter((sheet) => sheet?.dm_only),
    [sheetOrder, sheets]
  );

  return (
    <Panel
      title="XP Tracker"
      actions={
        <button
          className="button button--secondary"
          type="button"
          onClick={() => client.sendProtocolRequest(buildGetXpTrackerRequest(), "Refresh XP tracker")}
        >
          Refresh
        </button>
      }
    >
      <div className="xp-tracker-layout">
        <section className="xp-tracker-section">
          <h3>Level Readiness</h3>
          {!xpTracker ? <EmptyState message="XP tracker has not loaded." /> : null}
          {xpTracker?.sheets.length === 0 ? <EmptyState message="No player sheets available." /> : null}
          <div className="xp-progress-list">
            {xpTracker?.sheets.map((sheet) => {
              const currentXp = sheet.current_xp ?? 0;
              const xpRequired = sheet.xp_required ?? 0;
              return (
                <article className="xp-progress-row" key={sheet.sheet_id}>
                  <div className="xp-progress-row__header">
                    <strong>{sheet.name}</strong>
                    <span className={sheet.ready_to_level ? "status-badge status-badge--ready" : "status-badge"}>
                      {xpRequired === 0
                        ? "Threshold not set"
                        : sheet.ready_to_level
                          ? "Ready"
                          : `${currentXp} / ${xpRequired} XP`}
                    </span>
                  </div>
                  {xpRequired > 0 ? (
                    <progress value={Math.min(currentXp, xpRequired)} max={xpRequired}>
                      {currentXp} / {xpRequired}
                    </progress>
                  ) : null}
                  <div className="xp-mob-breakdown">
                    {sheet.mobs.filter((mob) => mob.count > 0).map((mob) => (
                      <span key={mob.sheet_id}>
                        {mob.name}: {mob.count} x {mob.xp_value ?? 0} = {mob.xp_earned ?? 0} XP
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="xp-tracker-section">
          <h3>Player Thresholds</h3>
          <div className="xp-config-list">
            {playerSheets.map((sheet) => (
              <div className="xp-config-row" key={sheet.id}>
                <strong>{sheet.name}</strong>
                <XpNumberEditor
                  label="XP required"
                  value={Number.parseInt(sheet.xp_cap, 10) || 0}
                  onSave={(xpRequired) =>
                    client.sendProtocolRequest(
                      buildSetSheetXpRequiredRequest({ sheetId: sheet.id, xpRequired }),
                      `Update XP threshold: ${sheet.name}`
                    )
                  }
                />
              </div>
            ))}
          </div>
        </section>

        <section className="xp-tracker-section">
          <h3>Mob XP Values</h3>
          <div className="xp-config-list">
            {mobSheets.map((sheet) => (
              <div className="xp-config-row" key={sheet.id}>
                <strong>{sheet.name}</strong>
                <XpNumberEditor
                  label="XP per kill"
                  value={sheet.xp_given_when_slayed}
                  onSave={(xpValue) =>
                    client.sendProtocolRequest(
                      buildSetMobXpValueRequest({ mobSheetId: sheet.id, xpValue }),
                      `Update mob XP: ${sheet.name}`
                    )
                  }
                />
              </div>
            ))}
          </div>
        </section>
      </div>
    </Panel>
  );
}
