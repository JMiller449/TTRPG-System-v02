import { useEffect, useRef } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import type { GameClient } from "@/hooks/useGameClient";
import {
  buildGetXpTrackerRequest,
  buildSetSheetMobKillCountRequest
} from "@/infrastructure/ws/requestBuilders";
import { EmptyState } from "@/shared/ui/EmptyState";

export function SheetKillsSection({
  client,
  instanceId,
  sheetId
}: {
  client: GameClient;
  instanceId: string;
  sheetId: string;
}): JSX.Element {
  const {
    state: {
      uiState: { xpTracker }
    }
  } = useAppStore();
  const requestedInstanceRef = useRef<string | null>(null);

  useEffect(() => {
    if (requestedInstanceRef.current === instanceId) {
      return;
    }
    requestedInstanceRef.current = instanceId;
    client.sendProtocolRequest(buildGetXpTrackerRequest(), "Load tracked kills");
  }, [client, instanceId]);

  const trackerSheet = xpTracker?.sheets.find((entry) => entry.sheet_id === sheetId);

  return (
    <section className="sheet-kills-section">
      <div className="inline-actions">
        <button
          className="button button--secondary"
          type="button"
          onClick={() => client.sendProtocolRequest(buildGetXpTrackerRequest(), "Refresh tracked kills")}
        >
          Refresh
        </button>
      </div>
      {!trackerSheet ? <EmptyState message="Tracked kills have not loaded." /> : null}
      {trackerSheet?.mobs.length === 0 ? (
        <EmptyState message="No mobs are configured for XP tracking." />
      ) : null}
      {trackerSheet && trackerSheet.mobs.length > 0 ? (
        <div className="xp-kill-list">
          {trackerSheet.mobs.map((mob) => (
            <div className="xp-kill-row" key={mob.sheet_id}>
              <strong>{mob.name}</strong>
              <div className="xp-kill-stepper">
                <button
                  type="button"
                  aria-label={`Decrease ${mob.name} kill count`}
                  disabled={mob.count === 0}
                  onClick={() =>
                    client.sendProtocolRequest(
                      buildSetSheetMobKillCountRequest({
                        sheetId: instanceId,
                        mobSheetId: mob.sheet_id,
                        count: Math.max(0, mob.count - 1)
                      }),
                      `Update kills: ${mob.name}`
                    )
                  }
                >
                  -
                </button>
                <output aria-label={`${mob.name} kill count`}>{mob.count}</output>
                <button
                  type="button"
                  aria-label={`Increase ${mob.name} kill count`}
                  onClick={() =>
                    client.sendProtocolRequest(
                      buildSetSheetMobKillCountRequest({
                        sheetId: instanceId,
                        mobSheetId: mob.sheet_id,
                        count: mob.count + 1
                      }),
                      `Update kills: ${mob.name}`
                    )
                  }
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
