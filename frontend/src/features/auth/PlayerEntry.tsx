import { useState } from "react";
import systemMark from "@/assets/system-mark.svg";
import { VIOLENTMONKEY_FIREFOX_URL } from "@/features/extension/installUrls";
import type { GameClient } from "@/hooks/useGameClient";
import { userscriptInstallUrl } from "@/infrastructure/config/websocketConfig";
import { buildClaimSheetAccessCodeRequest } from "@/infrastructure/ws/requestBuilders";
import { Field } from "@/shared/ui/Field";
import { IntentFeedbackToasts } from "@/shared/ui/IntentFeedbackBanners";
import { Panel } from "@/shared/ui/Panel";

export function PlayerBridgeInstallPanel({ installUrl }: { installUrl: string }): JSX.Element {
  return (
    <Panel title="Roll20 Bridge Setup">
      <div className="stack">
        <p className="muted">
          Install the browser userscript now. After opening your character sheet, use Install / Sync
          Bridge to connect it to your player character.
        </p>
        <div className="inline-actions">
          <a
            className="button button--secondary"
            href={VIOLENTMONKEY_FIREFOX_URL}
            target="_blank"
            rel="noreferrer"
          >
            Install Violentmonkey
          </a>
          <a className="button" href={installUrl} target="_blank" rel="noreferrer">
            Install Roll20 Bridge
          </a>
        </div>
      </div>
    </Panel>
  );
}

export function PlayerEntry({ client }: { client: GameClient }): JSX.Element {
  const [accessCode, setAccessCode] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const installUrl = userscriptInstallUrl(window.location.origin, import.meta.env.BASE_URL);

  const claimSheet = (): void => {
    const code = accessCode.trim();
    if (!code) {
      setLocalError("A sheet access code is required.");
      return;
    }

    setLocalError(null);
    client.sendProtocolRequest(buildClaimSheetAccessCodeRequest({ code }), "Claim sheet access");
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

        <PlayerBridgeInstallPanel installUrl={installUrl} />

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
      <IntentFeedbackToasts />
    </div>
  );
}
