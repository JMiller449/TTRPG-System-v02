import { useState } from "react";
import { useAppStore } from "@/app/state/store";
import type { Role } from "@/domain/models";
import type { GameClient } from "@/hooks/useGameClient";
import { Field } from "@/shared/ui/Field";
import { Panel } from "@/shared/ui/Panel";
import { makeId } from "@/shared/utils/id";

export function SessionLanding({ client }: { client: GameClient }): JSX.Element {
  const {
    state: { connection },
    dispatch
  } = useAppStore();
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role>("player");
  const [gmPasswordInput, setGmPasswordInput] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const ensureConnected = async (): Promise<void> => {
    if (connection.status === "connected") {
      return;
    }
    setIsConnecting(true);
    await client.connect();
    setIsConnecting(false);
  };

  const enterPlayerConsole = async (): Promise<void> => {
    setLocalError(null);
    await ensureConnected();
    dispatch({ type: "set_gm_authenticated", value: false });
    dispatch({ type: "set_gm_password", password: "" });
    dispatch({ type: "set_gm_view", view: "console" });
    dispatch({ type: "set_role", role: "player" });
  };

  const enterGMConsole = async (): Promise<void> => {
    const password = gmPasswordInput.trim();
    if (!password) {
      setLocalError("GM password is required.");
      return;
    }

    setLocalError(null);
    await ensureConnected();
    dispatch({ type: "set_gm_password", password });
    dispatch({ type: "set_gm_view", view: "console" });
    client.sendIntent({
      intentId: makeId("intent"),
      type: "authenticate_gm",
      payload: { password }
    });
    dispatch({ type: "set_gm_authenticated", value: true });
    dispatch({ type: "set_role", role: "gm" });
  };

  return (
    <div className="landing-shell">
      <div className="landing-card">
        <h1>TTRPG Sheet Console</h1>
        <p className="muted">
          Select a role to enter the console. Backend integration is transport-driven and may return placeholder data
          until API wiring is complete.
        </p>

        <Panel title="Session">
          <div className="stack">
            <Field label="Role">
              <select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value as Role)}>
                <option value="player">Player</option>
                <option value="gm">GM</option>
              </select>
            </Field>

            {selectedRole === "gm" ? (
              <Field label="GM Password">
                <input
                  type="password"
                  value={gmPasswordInput}
                  onChange={(event) => setGmPasswordInput(event.target.value)}
                  placeholder="Required to enter GM console"
                />
              </Field>
            ) : null}

            <button
              className="button"
              onClick={() => {
                if (selectedRole === "gm") {
                  void enterGMConsole();
                  return;
                }
                void enterPlayerConsole();
              }}
            >
              {selectedRole === "gm" ? "Enter GM Console" : "Continue as Player"}
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
