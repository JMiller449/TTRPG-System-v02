import type { ReactElement } from "react";

export type R6SyncState = "connecting" | "synced" | "pending" | "disconnected" | "error";

export interface SyncStatusProps {
  status: R6SyncState;
  version?: number;
  label?: string;
}

const defaults: Record<R6SyncState, string> = {
  connecting: "Connecting",
  synced: "Synced",
  pending: "Saving",
  disconnected: "Disconnected",
  error: "Sync error"
};

export function SyncStatus({ status, version, label = defaults[status] }: SyncStatusProps): ReactElement {
  return (
    <span className={`r6-sync r6-sync--${status}`} role="status">
      <span className="r6-sync__dot" aria-hidden="true" />
      <span>{label}{version !== undefined ? <small>v{version}</small> : null}</span>
    </span>
  );
}
