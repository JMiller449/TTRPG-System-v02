import { useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import systemMark from "@/assets/system-mark.svg";
import type { GameClient } from "@/hooks/useGameClient";
import { Field } from "@/shared/ui/Field";
import { IntentFeedbackBanners } from "@/shared/ui/IntentFeedbackBanners";
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
      setLocalError("A character, player, or GM code is required.");
      return;
    }

    setLocalError(null);
    await ensureConnected();
    dispatch({ type: "set_gm_view", view: "console" });
    client.authenticateWithCode(code);
  };

  return (
    <div className="r6-theme landing-shell">
      <div className="landing-card landing-card--system">
        <header className="landing-card__header">
          <img className="landing-card__mark" src={systemMark} alt="" aria-hidden="true" />
          <div>
            <p className="landing-card__eyebrow">Chip TTRPG Session Console</p>
            <h1>TTRPG Sheet Console</h1>
            <p className="muted">Enter a character sheet code, shared player code, or GM code.</p>
          </div>
        </header>

        <div className="landing-status-strip" aria-label="Connection status">
          <span className={`pill pill--${connection.status}`}>{connection.status}</span>
          {isConnecting ? <span className="pill pill--connecting">connecting...</span> : null}
          <span className="landing-status-strip__meta">Live game connection</span>
        </div>

        <Panel title="Enter Code">
          <div className="stack">
            <Field label="Session or Character Code">
              <input
                type="password"
                value={codeInput}
                onChange={(event) => setCodeInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void submitCode();
                  }
                }}
                placeholder="Enter character, player, or GM code"
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

            {localError ? <p className="error-text">{localError}</p> : null}
          </div>
        </Panel>
      </div>
      <IntentFeedbackBanners />
    </div>
  );
}
