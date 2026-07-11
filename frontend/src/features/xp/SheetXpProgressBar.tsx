import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import type { GameClient } from "@/hooks/useGameClient";
import { buildGetXpTrackerRequest } from "@/infrastructure/ws/requestBuilders";

function clampPercent(value: number, max: number): number {
  if (max <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, (value / max) * 100));
}

export function SheetXpProgressBar({
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
  const requestedRefreshKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const refreshKey = instanceId;
    if (requestedRefreshKeyRef.current === refreshKey) {
      return;
    }
    requestedRefreshKeyRef.current = refreshKey;
    client.sendProtocolRequest(buildGetXpTrackerRequest(), "Load XP progress");
  }, [client, instanceId]);

  const trackerSheet = xpTracker?.sheets.find((entry) => entry.instance_id === instanceId);
  const currentXp = trackerSheet?.current_xp ?? 0;
  const xpRequired = trackerSheet?.xp_required ?? 0;
  const fillPercent = clampPercent(currentXp, xpRequired);
  const readyToLevel = trackerSheet?.ready_to_level === true;
  const hasThreshold = xpRequired > 0;
  const title = readyToLevel ? "Ready to level up" : "Experience";
  const statusText = !trackerSheet
    ? "Loading XP"
    : !hasThreshold
      ? "Threshold not set"
      : readyToLevel
        ? `${currentXp} / ${xpRequired} XP`
        : `${Math.max(0, xpRequired - currentXp)} XP to level`;

  return (
    <section
      className={`sheet-xp-progress ${readyToLevel ? "sheet-xp-progress--ready" : ""}`}
      aria-label="Experience progress"
    >
      <div className="sheet-xp-progress__header">
        <div>
          <h4>{title}</h4>
          <p>{statusText}</p>
        </div>
        {trackerSheet && hasThreshold ? (
          <strong className="sheet-xp-progress__value">
            {currentXp} / {xpRequired} XP
          </strong>
        ) : null}
      </div>
      <div
        className="sheet-xp-progress__meter"
        role={hasThreshold ? "progressbar" : undefined}
        aria-valuemin={hasThreshold ? 0 : undefined}
        aria-valuemax={hasThreshold ? xpRequired : undefined}
        aria-valuenow={hasThreshold ? Math.min(currentXp, xpRequired) : undefined}
        aria-valuetext={hasThreshold ? `${currentXp} of ${xpRequired} XP` : undefined}
        style={{ "--xp-progress-fill": `${fillPercent}%` } as CSSProperties}
      >
        <span className="sheet-xp-progress__fill" />
      </div>
    </section>
  );
}
