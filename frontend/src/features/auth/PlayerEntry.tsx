import { useState } from "react";
import systemMark from "@/assets/system-mark.svg";
import type { GameClient } from "@/hooks/useGameClient";
import { buildClaimSheetAccessCodeRequest } from "@/infrastructure/ws/requestBuilders";
import { Field } from "@/shared/ui/Field";
import { Panel } from "@/shared/ui/Panel";

export function PlayerEntry({ client }: { client: GameClient }): JSX.Element {
  const [accessCode, setAccessCode] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const claimSheet = (): void => {
    const code = accessCode.trim();
    if (!code) {
      setLocalError("A sheet access code is required.");
      return;
    }

    setLocalError(null);
    client.sendProtocolRequest(
      buildClaimSheetAccessCodeRequest({ code }),
      "Claim sheet access"
    );
  };

  return (
    <div className="r6-theme landing-shell">
      <div className="landing-card landing-card--system">
        <header className="landing-card__header">
          <img className="landing-card__mark" src={systemMark} alt="" aria-hidden="true" />
          <div>
            <p className="landing-card__eyebrow">Player Access</p>
            <h1>Claim Character Sheet</h1>
            <p className="muted">Enter the sheet access code provided by your GM.</p>
          </div>
        </header>

        <Panel title="Sheet Access Code">
          <div className="stack">
            <Field label="Access Code">
              <input
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    claimSheet();
                  }
                }}
                placeholder="e.g. MAGE2026"
              />
            </Field>

            <button className="button" onClick={claimSheet} disabled={!accessCode.trim()}>
              Open Character Sheet
            </button>

            {localError ? <p className="error-text">{localError}</p> : null}
          </div>
        </Panel>

        <div className="landing-actions">
          <button
            className="button button--secondary"
            onClick={() => {
              client.endSession();
            }}
          >
            Back to Code Entry
          </button>
        </div>
      </div>
    </div>
  );
}
