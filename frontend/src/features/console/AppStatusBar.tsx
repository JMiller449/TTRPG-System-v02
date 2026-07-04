import { useAppStore } from "@/app/state/useAppStore";
import { selectActiveSheetDetail } from "@/app/state/selectors";
import systemMark from "@/assets/system-mark.svg";
import type { Role } from "@/domain/models";
import type { GameClient } from "@/hooks/useGameClient";

function statusLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function AppStatusBar({
  role,
  client
}: {
  role: Role;
  client: GameClient;
}): JSX.Element {
  const { state } = useAppStore();
  const activeDetail = selectActiveSheetDetail(state);
  const { connection, intentFeedback, pendingIntentIds, roll20Bridge } = state.uiState;
  const syncRecovery = intentFeedback.find(
    (item) => item.status === "pending" && item.message.toLowerCase().includes("resync")
  );
  const syncStatus = syncRecovery ? "resyncing" : connection.status === "connected" ? "synced" : "stale";
  const activeName = activeDetail?.instance.name ?? "No active sheet";

  return (
    <header className={`app-status-bar app-status-bar--${role}`} aria-label="Application status">
      <div className="app-status-bar__identity">
        <img className="app-status-bar__mark" src={systemMark} alt="" aria-hidden="true" />
        <div className="app-status-bar__identity-copy">
          <p className="app-header__eyebrow">
            {role === "gm" ? "GM Workspace" : "Player Console"}
          </p>
          <h1>{activeName}</h1>
        </div>
      </div>
      <div className="app-status-bar__statuses">
        <span className={`system-status system-status--${connection.status}`}>
          <span aria-hidden="true" />
          Backend {statusLabel(connection.status)}
        </span>
        <span className={`system-status system-status--${syncStatus}`}>
          <span aria-hidden="true" />
          {syncStatus === "resyncing" ? "Resyncing" : syncStatus === "synced" ? "Synced" : "State Stale"}
        </span>
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
