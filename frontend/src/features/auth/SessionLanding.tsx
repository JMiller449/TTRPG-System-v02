import { useState } from "react";
import { useAppStore } from "@/app/state/store";
import type { GameClient } from "@/hooks/useGameClient";
import { Field } from "@/shared/ui/Field";
import { Panel } from "@/shared/ui/Panel";

export function SessionLanding({ client }: { client: GameClient }): JSX.Element {
  const {
    state: {
      uiState: { connection }
    },
    dispatch
  } = useAppStore();
  const [isConnecting, setIsConnecting] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const ensureConnected = async (): Promise<void> => {
    if (connection.status === "connected") {
      return;
    }
    setIsConnecting(true);
    await client.connect();
    setIsConnecting(false);
  };

  const submitCode = async (): Promise<void> => {
    const code = codeInput.trim();
    if (!code) {
      setLocalError("A player or GM code is required.");
      return;
    }

    setLocalError(null);
    await ensureConnected();
    dispatch({ type: "set_gm_view", view: "console" });
    client.authenticateWithCode(code);
  };

  return (
    <div className="landing-shell">
      <div className="landing-card">
        <h1>TTRPG Sheet Console</h1>
        <p className="muted">
          Enter your player or GM code. The backend decides which console access that code grants.
        </p>

        <Panel title="Enter Code">
          <div className="stack">
            <Field label="Access Code">
              <input
                type="password"
                value={codeInput}
                onChange={(event) => setCodeInput(event.target.value)}
                placeholder="Enter player or GM code"
              />
            </Field>

            <button
              className="button"
              onClick={() => {
                void submitCode();
              }}
              disabled={!codeInput.trim()}
            >
              Enter Console
            </button>

            <div className="status-row">
              <span className={`pill pill--${connection.status}`}>{connection.status}</span>
              <span className="pill">transport: {connection.transport}</span>
              {isConnecting ? <span className="pill pill--connecting">connecting...</span> : null}
            </div>

            {localError ? <p className="error-text">{localError}</p> : null}
            {connection.error ? <p className="error-text">{connection.error}</p> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
