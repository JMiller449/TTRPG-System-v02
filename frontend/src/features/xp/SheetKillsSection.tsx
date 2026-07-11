import { useEffect, useRef } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import type { GameClient } from "@/hooks/useGameClient";
import { buildGetXpTrackerRequest } from "@/infrastructure/ws/requestBuilders";
import { EmptyState } from "@/shared/ui/EmptyState";

function formatXp(value: number): string {
  return value.toFixed(2).replace(/\.00$/, "");
}

export function SheetKillsSection({
  client,
  instanceId
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
    if (requestedInstanceRef.current === instanceId) return;
    requestedInstanceRef.current = instanceId;
    client.sendProtocolRequest(buildGetXpTrackerRequest(), "Load kill registry");
  }, [client, instanceId]);

  const trackerSheet = xpTracker?.sheets.find((entry) => entry.instance_id === instanceId);

  return (
    <section className="sheet-kills-section">
      <div className="inline-actions">
        <button
          className="button button--secondary"
          type="button"
          onClick={() =>
            client.sendProtocolRequest(buildGetXpTrackerRequest(), "Refresh kill registry")
          }
        >
          Refresh
        </button>
      </div>
      {!trackerSheet ? <EmptyState message="Kill history has not loaded." /> : null}
      {trackerSheet?.kills.length === 0 ? <EmptyState message="No recorded kills." /> : null}
      {trackerSheet?.kills.map((kill) => (
        <article className="xp-kill-row" key={kill.id}>
          <div>
            <strong>{kill.monster_name}</strong>
            <span>{new Date(kill.occurred_at).toLocaleString()}</span>
          </div>
          <div className="xp-kill-row__award">
            <strong>{formatXp(kill.xp_per_participant)} XP</strong>
            <span>
              {formatXp(kill.xp_percentage)}% · {kill.participant_count} participant
              {kill.participant_count === 1 ? "" : "s"}
            </span>
          </div>
        </article>
      ))}
      {trackerSheet && trackerSheet.adjustments.length > 0 ? (
        <div className="xp-adjustment-list">
          <h4>XP Adjustments</h4>
          {trackerSheet.adjustments.map((adjustment) => (
            <div className="xp-adjustment-row" key={adjustment.id}>
              <span>{adjustment.reason || "Manual adjustment"}</span>
              <strong>{formatXp(adjustment.amount)} XP</strong>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
