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
    >
      <div className="stack">
        {detectionState === "checking" ? (
          <p className="muted">Checking for the Roll20 bridge userscript…</p>
        ) : detectionState === "not_detected" ? (
          <section className="stack" aria-labelledby="userscript-stage-title">
            <h3 id="userscript-stage-title">Install Roll20 Bridge</h3>
            <p className="muted">
              No active bridge userscript responded. Complete these steps in order.
            </p>
            <ol className="stack extension-install-steps">
              <li>
                <strong>Install Violentmonkey and approve its requested permissions.</strong>
                <div>
                  <a
                    className="button button--secondary"
                    href={VIOLENTMONKEY_FIREFOX_URL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Install Violentmonkey
                  </a>
                </div>
              </li>
              <li>
                <strong>Install the Roll20 bridge script.</strong>
                <p className="muted">
                  Violentmonkey will open the script installer. Use the Install button on the left
                  side.
                </p>
                <div>
                  <a className="button" href={installUrl} target="_blank" rel="noreferrer">
                    Install Roll20 Bridge
                  </a>
                </div>
              </li>
              <li>
                <strong>Reload this page after the script is installed.</strong>
                <div>
                  <button
                    className="button button--secondary"
                    onClick={() => window.location.reload()}
                  >
                    Reload Page
                  </button>
                </div>
              </li>
              <li>
                <strong>Log in again. The bridge will then appear here.</strong>
              </li>
            </ol>
            <button className="button button--secondary" onClick={() => void detect()}>
              Detect Again
            </button>
          </section>
        ) : (
          <section className="stack" aria-labelledby="sync-stage-title">
            <h3 id="sync-stage-title">Synchronize Bridge</h3>
            <p className="muted">
              Userscript version {discovery?.version}. Syncing binds this browser to your current
              user and character for Roll20 delivery.
            </p>
            <p className="muted">
              Synchronization only saves the bridge configuration and does not require Roll20 to be
              open. Roll20 status remains disconnected until an editor tab is opened or reloaded.
            </p>
            <dl>
              <dt>Current user</dt>
              <dd>{roll20Bridge.bindingLabel ?? "Claim a character sheet first"}</dd>
              <dt>Userscript binding</dt>
              <dd>{discovery?.bindingLabel ?? "Not synchronized"}</dd>
            </dl>
            {discovery?.synchronized && !bindingMatches ? (
              <p className="field-error">
                This userscript is configured for a different user or character. Sync it again
                before sending rolls.
              </p>
            ) : null}
            {synchronized ? (
              <dl>
                <dt>Environment</dt>
                <dd>{discovery?.environment ?? environment}</dd>
                <dt>Endpoint</dt>
                <dd>{discovery?.endpoint ?? bridgeUrl}</dd>
                <dt>Roll20 status</dt>
                <dd>{roll20Bridge.status}</dd>
              </dl>
            ) : null}
            <div className="inline-group">
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
            <p className="muted">
              Each player and the DM must install and sync the userscript in their own browser. Open
              or reload the Roll20 editor after installing, updating, or switching characters.
            </p>
          </section>
        )}
        {error ? <p className="field-error">{error}</p> : null}
      </div>
    </Panel>
  );
}
