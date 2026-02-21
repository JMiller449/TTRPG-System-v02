import { useState } from "react";
import { useAppStore } from "@/app/state/store";
import { Panel } from "@/shared/ui/Panel";
import type { GameClient } from "@/hooks/useGameClient";

export function AuthPanel({ client }: { client: GameClient }): JSX.Element {
  const {
    state: { gmAuthenticated, connection, pendingIntentIds }
  } = useAppStore();
  const [isConnecting, setIsConnecting] = useState(false);

  const connectOrDisconnect = async (): Promise<void> => {
    if (connection.status === "connected") {
      client.disconnect();
      return;
    }
    setIsConnecting(true);
    await client.connect();
    setIsConnecting(false);
  };

  return (
    <Panel
      title="Session Status"
      actions={
        <button className="button button--secondary" onClick={connectOrDisconnect} disabled={isConnecting}>
          {connection.status === "connected" ? "Disconnect" : "Connect"}
        </button>
      }
    >
      <div className="stack">
        <div className="status-row">
          <span className={`pill pill--${connection.status}`}>{connection.status}</span>
          <span className="pill">transport: {connection.transport}</span>
          <span className="pill">pending: {pendingIntentIds.length}</span>
          <span className={`pill ${gmAuthenticated ? "pill--resolved" : "pill--failed"}`}>
            gm auth: {gmAuthenticated ? "enabled" : "disabled"}
          </span>
        </div>

        {connection.error ? <p className="error-text">{connection.error}</p> : null}
      </div>
    </Panel>
  );
}
