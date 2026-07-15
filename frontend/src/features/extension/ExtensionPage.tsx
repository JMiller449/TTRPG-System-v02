import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import {
  bridgeEnvironment,
  deriveRoll20BridgeUrl,
  resolveApplicationWebSocketUrl,
  userscriptInstallUrl
} from "@/infrastructure/config/websocketConfig";
import type { GameClient } from "@/hooks/useGameClient";
import {
  buildGetRoll20BridgeStatusRequest,
  buildGetRoll20BridgeSyncConfigRequest,
  buildSendRoll20ChatMessageRequest
} from "@/infrastructure/ws/requestBuilders";
import { makeId } from "@/shared/utils/id";
import { Panel } from "@/shared/ui/Panel";
import {
  discoverBridgeUserscript,
  synchronizeBridgeUserscript,
  type UserscriptDiscovery
} from "@/features/extension/bridgeUserscriptChannel";

const VIOLENTMONKEY_FIREFOX_URL = "https://addons.mozilla.org/firefox/addon/violentmonkey/";
const SYNC_RESPONSE_TIMEOUT_MS = 5000;

type DetectionState = "checking" | "not_detected" | "detected";
type SyncState = "idle" | "syncing" | "synced" | "error";

export function ExtensionPage({ client }: { client: GameClient }): JSX.Element {
  const {
    state: {
      uiState: { roll20Bridge }
    }
  } = useAppStore();
  const [detectionState, setDetectionState] = useState<DetectionState>("checking");
  const [discovery, setDiscovery] = useState<UserscriptDiscovery | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [error, setError] = useState<string | null>(null);

  const applicationUrl = useMemo(
    () => resolveApplicationWebSocketUrl(import.meta.env.VITE_WS_URL),
    []
  );
  const bridgeUrl = useMemo(() => deriveRoll20BridgeUrl(applicationUrl), [applicationUrl]);
  const environment = useMemo(() => bridgeEnvironment(bridgeUrl), [bridgeUrl]);
  const installUrl = useMemo(
    () => userscriptInstallUrl(window.location.origin, import.meta.env.BASE_URL),
    []
  );

  const detect = async (): Promise<void> => {
    setDetectionState("checking");
    setError(null);
    const detected = await discoverBridgeUserscript();
    setDiscovery(detected);
    setDetectionState(detected ? "detected" : "not_detected");
    if (detected?.synchronized) {
      setSyncState("synced");
    } else {
      setSyncState("idle");
    }
  };

  useEffect(() => {
    void detect();
    client.sendProtocolRequest(buildGetRoll20BridgeStatusRequest(), "Roll20 bridge status");
  }, [client]);

  const syncBridge = (): void => {
    if (!discovery || !roll20Bridge.bindingKey) {
      return;
    }
    setSyncState("syncing");
    setError(null);
    const requestId = makeId("bridge-sync");
    let responseTimer = 0;
    const unsubscribe = client.onEvent((event) => {
      if (event.type !== "roll20_bridge_sync_config" || event.requestId !== requestId) {
        return;
      }
      window.clearTimeout(responseTimer);
      unsubscribe();
      void synchronizeBridgeUserscript({
        discoveryNonce: discovery.nonce,
        endpoint: bridgeUrl,
        environment,
        bridgeAuthToken: event.bridgeAuthToken,
        bindingKey: event.bindingKey,
        bindingLabel: event.bindingLabel
      })
        .then((result) => {
          setDiscovery({
            nonce: discovery.nonce,
            version: result.version,
            synchronized: true,
            environment: result.environment,
            endpoint: result.endpoint,
            bindingKey: result.bindingKey,
            bindingLabel: result.bindingLabel
          });
          setSyncState("synced");
          client.sendProtocolRequest(buildGetRoll20BridgeStatusRequest(), "Roll20 bridge status");
        })
        .catch((syncError: unknown) => {
          setSyncState("error");
          setError(
            syncError instanceof Error ? syncError.message : "Bridge synchronization failed."
          );
        });
    });

    responseTimer = window.setTimeout(() => {
      unsubscribe();
      setSyncState("error");
      setError("Timed out waiting for the backend synchronization response.");
    }, SYNC_RESPONSE_TIMEOUT_MS);

    client.sendProtocolRequest(
      buildGetRoll20BridgeSyncConfigRequest({ requestId }),
      "Sync Roll20 bridge"
    );
  };

  const sendTestMessage = (): void => {
    client.sendProtocolRequest(
      buildSendRoll20ChatMessageRequest({
        message: "TTRPG Roll20 bridge test message."
      }),
      "Roll20 test message"
    );
  };

  const bindingMatches =
    discovery?.bindingKey !== null && discovery?.bindingKey === roll20Bridge.bindingKey;
  const synchronized =
    discovery?.synchronized === true &&
    discovery.endpoint === bridgeUrl &&
    discovery.environment === environment &&
    bindingMatches;

  return (
    <Panel
      title="Extension"
      subtitle="Install, synchronize, and verify the Firefox Roll20 chat bridge."
      className="extension-panel"
    >
      <div className="stack">
        {detectionState === "checking" ? (
          <p className="muted">Checking for the Roll20 bridge userscript…</p>
        ) : detectionState === "not_detected" ? (
          <section
            className="stack extension-stage extension-stage--install"
            aria-labelledby="userscript-stage-title"
          >
            <header className="extension-stage__intro">
              <span className="extension-stage__eyebrow">Browser setup</span>
              <h3 id="userscript-stage-title">Install Roll20 Bridge</h3>
              <p className="muted">
                No active bridge userscript responded. Complete these four steps to connect this
                browser to Roll20.
              </p>
            </header>
            <ol className="extension-install-steps">
              <li>
                <div className="extension-install-step__content">
                  <strong>Install Violentmonkey and approve its requested permissions.</strong>
                  <p className="muted extension-install-step__hint">
                    Add the Firefox extension that manages the Roll20 bridge script.
                  </p>
                  <a
                    className="button button--secondary extension-install-step__action"
                    href={VIOLENTMONKEY_FIREFOX_URL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Install Violentmonkey
                  </a>
                </div>
              </li>
              <li>
                <div className="extension-install-step__content">
                  <strong>Install the Roll20 bridge script.</strong>
                  <p className="muted extension-install-step__hint">
                    Violentmonkey will open the script installer. Use the Install button on the left
                    side.
                  </p>
                  <a
                    className="button extension-install-step__action"
                    href={installUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Install Roll20 Bridge
                  </a>
                </div>
              </li>
              <li>
                <div className="extension-install-step__content">
                  <strong>Reload this page after the script is installed.</strong>
                  <p className="muted extension-install-step__hint">
                    Return to this tab and reload it so the newly installed bridge can start.
                  </p>
                  <button
                    type="button"
                    className="button button--secondary extension-install-step__action"
                    onClick={() => window.location.reload()}
                  >
                    Reload Page
                  </button>
                </div>
              </li>
              <li>
                <div className="extension-install-step__content">
                  <strong>Log in again. The bridge will then appear here.</strong>
                  <p className="muted extension-install-step__hint">
                    Use your player or DM access code, then open Extension to synchronize it.
                  </p>
                  <span className="extension-install-step__outcome">Ready to synchronize</span>
                </div>
              </li>
            </ol>
            <div className="extension-stage__retry">
              <span className="muted">Already completed these steps?</span>
              <button
                type="button"
                className="button button--secondary"
                onClick={() => void detect()}
              >
                Detect Again
              </button>
            </div>
          </section>
        ) : (
          <section
            className="stack extension-stage extension-stage--sync"
            aria-labelledby="sync-stage-title"
          >
            <header className="extension-sync__header">
              <div>
                <span className="extension-stage__eyebrow">
                  {synchronized ? "Bridge synchronized" : "Bridge detected"}
                </span>
                <h3 id="sync-stage-title">Synchronize Bridge</h3>
              </div>
              <span className="extension-sync__version">
                Userscript <strong>v{discovery?.version}</strong>
              </span>
            </header>
            <div className="extension-sync__copy">
              <p>Bind this browser to your current user and character for Roll20 chat delivery.</p>
              <p className="muted">
                Roll20 can stay closed while you synchronize. Its connection status updates after an
                editor tab is opened or reloaded.
              </p>
            </div>
            <dl className="extension-sync__details">
              <div>
                <dt>Current user</dt>
                <dd>{roll20Bridge.bindingLabel ?? "Claim a character sheet first"}</dd>
              </div>
              <div>
                <dt>Userscript binding</dt>
                <dd>{discovery?.bindingLabel ?? "Not synchronized"}</dd>
              </div>
              {synchronized ? (
                <>
                  <div>
                    <dt>Environment</dt>
                    <dd>{discovery?.environment ?? environment}</dd>
                  </div>
                  <div>
                    <dt>Roll20 status</dt>
                    <dd>{roll20Bridge.status}</dd>
                  </div>
                  <div className="extension-sync__detail--wide">
                    <dt>Endpoint</dt>
                    <dd>{discovery?.endpoint ?? bridgeUrl}</dd>
                  </div>
                </>
              ) : null}
            </dl>
            {discovery?.synchronized && !bindingMatches ? (
              <p className="field-error">
                This userscript is configured for a different user or character. Sync it again
                before sending rolls.
              </p>
            ) : null}
            <div className="extension-sync__actions">
              <button
                className="button"
                disabled={!roll20Bridge.bindingKey || syncState === "syncing"}
                onClick={syncBridge}
              >
                {synchronized ? "Resync Bridge" : "Sync Bridge"}
              </button>
              <button
                className="button button--secondary"
                disabled={!synchronized}
                onClick={() =>
                  client.sendProtocolRequest(
                    buildGetRoll20BridgeStatusRequest(),
                    "Roll20 bridge status"
                  )
                }
              >
                Refresh Status
              </button>
              <button
                className="button button--secondary"
                disabled={!synchronized || roll20Bridge.status !== "connected"}
                onClick={sendTestMessage}
              >
                Send Test Message
              </button>
            </div>
            <aside className="extension-sync__note">
              <strong>Per-browser setup</strong>
              <p className="muted">
                Each player and the DM must install and sync their own userscript. Open or reload
                Roll20 after installing, updating, or switching characters.
              </p>
            </aside>
          </section>
        )}
        {error ? <p className="field-error">{error}</p> : null}
      </div>
    </Panel>
  );
}
