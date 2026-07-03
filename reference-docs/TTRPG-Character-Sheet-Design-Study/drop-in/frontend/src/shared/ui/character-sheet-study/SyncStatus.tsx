import type { ReactElement } from "react";
import type { SyncStatusViewModel } from "./types";

const DEFAULT_LABELS: Record<SyncStatusViewModel["state"], string> = {
  offline: "Offline",
  connecting: "Connecting",
  synced: "Synced",
  pending: "Saving",
  stale: "Resyncing",
  error: "Sync error"
};

export function SyncStatus({ status }: { status: SyncStatusViewModel }): ReactElement {
  const label = status.label ?? DEFAULT_LABELS[status.state];
  const message = status.detail ? `${label}. ${status.detail}` : label;

  return (
    <div
      className={`cs-sync cs-sync--${status.state}`}
      role={status.state === "error" ? "alert" : "status"}
      aria-live={status.state === "error" ? "assertive" : "polite"}
      aria-label={message}
      title={status.detail}
    >
      <span className="cs-sync__dot" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
