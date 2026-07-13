import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import type { GameClient } from "@/hooks/useGameClient";
import {
  buildGetXpTrackerRequest,
  buildRecordPlayerKillRequest
} from "@/infrastructure/ws/requestBuilders";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Field } from "@/shared/ui/Field";
import { makeId } from "@/shared/utils/id";

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
  const submittingRequestRef = useRef<string | null>(null);
  const [selectedMobId, setSelectedMobId] = useState("");
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (requestedInstanceRef.current === instanceId) return;
    requestedInstanceRef.current = instanceId;
    client.sendProtocolRequest(buildGetXpTrackerRequest(), "Load kill registry");
  }, [client, instanceId]);

  useEffect(
    () =>
      client.onEvent((event) => {
        const requestId = submittingRequestRef.current;
        if (!requestId || !("requestId" in event) || event.requestId !== requestId) return;
        if (event.type === "error") {
          submittingRequestRef.current = null;
          setPendingRequestId(null);
          return;
        }
        if (event.type === "snapshot" || event.type === "xp_tracker") {
          submittingRequestRef.current = null;
          setPendingRequestId(null);
          setSelectedMobId("");
        }
      }),
    [client]
  );

  const trackerSheet = xpTracker?.sheets.find((entry) => entry.instance_id === instanceId);

  return (
    <section className="sheet-kills-section">
      {xpTracker && !xpTracker.can_manage ? (
        <form
          className="xp-player-kill-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!selectedMobId || submittingRequestRef.current) return;
            const requestId = makeId("request");
            submittingRequestRef.current = requestId;
            setPendingRequestId(requestId);
            client.sendProtocolRequest(
              buildRecordPlayerKillRequest({
                killId: makeId("kill"),
                monsterSheetId: selectedMobId,
                requestId
              }),
              "Record kill"
            );
          }}
        >
          <Field label="Defeated enemy">
            <select
              value={selectedMobId}
              disabled={pendingRequestId !== null}
              onChange={(event) => setSelectedMobId(event.target.value)}
            >
              <option value="">Select enemy</option>
              {xpTracker.recordable_mobs.map((mob) => (
                <option key={mob.sheet_id} value={mob.sheet_id}>
                  {mob.name}
                </option>
              ))}
            </select>
          </Field>
          <button
            className="button button--primary"
            type="submit"
            disabled={!selectedMobId || pendingRequestId !== null}
          >
            {pendingRequestId ? "Recording…" : "Record Kill"}
          </button>
          {xpTracker.recordable_mobs.length === 0 ? (
            <small>No enemies are currently available to record.</small>
          ) : null}
        </form>
      ) : null}
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
            {kill.submitted_by_name ? <span>Recorded by {kill.submitted_by_name}</span> : null}
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
