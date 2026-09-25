import { useEffect, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import { IntentFeedbackHistory } from "@/features/console/IntentFeedbackHistory";
import { discoverBridgeUserscript } from "@/features/extension/bridgeUserscriptChannel";
import type { GameClient } from "@/hooks/useGameClient";

function statusLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function ConsoleSidebarStatus({ client }: { client: GameClient }): JSX.Element {
  const { state } = useAppStore();
  const [extensionStatus, setExtensionStatus] = useState<"checking" | "connected" | "missing">(
    "checking"
  );
  const { connection, intentFeedback, pendingIntentIds, roll20Bridge } = state.uiState;
  const syncRecovery = intentFeedback.find(
    (item) => item.status === "pending" && item.message.toLowerCase().includes("resync")
  );
  const syncStatus = syncRecovery
    ? "resyncing"
    : connection.status === "connected"
      ? "synced"
      : "stale";

  useEffect(() => {
    let active = true;
    void discoverBridgeUserscript().then((discovery) => {
      if (active) {
        setExtensionStatus(discovery ? "connected" : "missing");
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const resolvedExtensionStatus =
    extensionStatus === "checking"
      ? "unknown"
      : extensionStatus === "connected"
        ? "connected"
        : "disconnected";
  const extensionLabel =
    extensionStatus === "checking"
      ? "Extension Checking"
      : extensionStatus === "connected"
        ? "Extension Connected"
        : "Extension Not Detected";

  return (
    <footer className="console-sidebar__footer" aria-label="Application status">
      <div className="console-sidebar__statuses">
        <span
          className={`system-status system-status--${connection.status}`}
          aria-label={`Backend ${statusLabel(connection.status)}`}
          title={`Backend ${statusLabel(connection.status)}`}
        >
          <span className="system-status__indicator" aria-hidden="true" />
          <span className="system-status__label">Backend</span>
        </span>
        <span
          className={`system-status system-status--${resolvedExtensionStatus}`}
          aria-label={extensionLabel}
          title={extensionLabel}
        >
          <span className="system-status__indicator" aria-hidden="true" />
          <span className="system-status__label">Extension</span>
        </span>
        {syncStatus !== "synced" ? (
          <span
            className={`system-status system-status--${syncStatus} console-sidebar__sync-status`}
          >
            <span className="system-status__indicator" aria-hidden="true" />
            <span className="system-status__label">
              {syncStatus === "resyncing" ? "Resyncing" : "State Stale"}
            </span>
          </span>
        ) : null}
        <span
          className={`system-status system-status--${roll20Bridge.status}`}
          aria-label={`Roll20 ${statusLabel(roll20Bridge.status)}`}
          title={`Roll20 ${statusLabel(roll20Bridge.status)}`}
        >
          <span className="system-status__indicator" aria-hidden="true" />
          <span className="system-status__label">Roll20</span>
        </span>
        <span className="system-status" aria-label={`${pendingIntentIds.length} pending requests`}>
          <span className="system-status__indicator" aria-hidden="true" />
          <span className="system-status__label">Pending {pendingIntentIds.length}</span>
        </span>
        <IntentFeedbackHistory />
      </div>
      <button
        type="button"
        className="button button--secondary console-sidebar__exit"
        onClick={() => client.endSession()}
      >
        Exit
      </button>
    </footer>
  );
}
