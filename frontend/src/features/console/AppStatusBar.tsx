import { useEffect, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import { selectActiveSheetDetail } from "@/app/state/selectors";
import systemMark from "@/assets/system-mark.svg";
import type { Role } from "@/domain/models";
import { GM_TOOLBAR_NAV_ITEMS } from "@/features/console/gmConsoleToolbarData";
import { discoverBridgeUserscript } from "@/features/extension/bridgeUserscriptChannel";
import type { GameClient } from "@/hooks/useGameClient";

function statusLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function AppStatusBar({ role, client }: { role: Role; client: GameClient }): JSX.Element {
  const { state } = useAppStore();
  const [extensionStatus, setExtensionStatus] = useState<"checking" | "connected" | "missing">(
    "checking"
  );
  const activeDetail = selectActiveSheetDetail(state);
  const { connection, gmView, intentFeedback, pendingIntentIds, roll20Bridge } = state.uiState;
  const syncRecovery = intentFeedback.find(
    (item) => item.status === "pending" && item.message.toLowerCase().includes("resync")
  );
  const syncStatus = syncRecovery
    ? "resyncing"
    : connection.status === "connected"
      ? "synced"
      : "stale";
  const playerTitle = activeDetail?.instance.name ?? "No active sheet";
  const gmTitle = GM_TOOLBAR_NAV_ITEMS.find((item) => item.view === gmView)?.label ?? "Dashboard";

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

  return (
    <header className={`app-status-bar app-status-bar--${role}`} aria-label="Application status">
      <div className="app-status-bar__identity">
        <img className="app-status-bar__mark" src={systemMark} alt="" aria-hidden="true" />
        <div className="app-status-bar__identity-copy">
          <p className="app-header__eyebrow">{role === "gm" ? "GM Workspace" : "Player Console"}</p>
          <h1>{role === "gm" ? gmTitle : playerTitle}</h1>
        </div>
      </div>
      <div className="app-status-bar__statuses">
        <span className={`system-status system-status--${connection.status}`}>
          <span aria-hidden="true" />
          Backend {statusLabel(connection.status)}
        </span>
        <span
          className={`system-status system-status--${
            extensionStatus === "checking"
              ? "unknown"
              : extensionStatus === "connected"
                ? "connected"
                : "disconnected"
          }`}
        >
          <span aria-hidden="true" />
          {extensionStatus === "checking"
            ? "Extension Checking"
            : extensionStatus === "connected"
              ? "Extension Connected"
              : "Extension Not Detected"}
        </span>
        {syncStatus !== "synced" ? (
          <span className={`system-status system-status--${syncStatus}`}>
            <span aria-hidden="true" />
            {syncStatus === "resyncing" ? "Resyncing" : "State Stale"}
          </span>
        ) : null}
        <span className={`system-status system-status--${roll20Bridge.status}`}>
          <span aria-hidden="true" />
          Roll20 {statusLabel(roll20Bridge.status)}
        </span>
        <span className="system-status">
          <span aria-hidden="true" />
          Pending {pendingIntentIds.length}
        </span>
      </div>
      <button
        type="button"
        className="button button--secondary app-status-bar__exit"
        onClick={() => {
          client.endSession();
        }}
      >
        Exit
      </button>
    </header>
  );
}
