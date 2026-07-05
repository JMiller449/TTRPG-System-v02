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
      serverState: { role },
      uiState: { roll20Bridge }
    }
  } = useAppStore();
  const [continued, setContinued] = useState(false);
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
  }, []);

  const syncBridge = (): void => {
    if (role !== "gm" || !discovery) {
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
      const serviceAuthCode = event.serviceAuthCode;
      void synchronizeBridgeUserscript({
        discoveryNonce: discovery.nonce,
        endpoint: bridgeUrl,
        environment,
        serviceAuthCode
      })
        .then((result) => {
          setDiscovery({
            nonce: discovery.nonce,
            version: result.version,
            synchronized: true,
            environment: result.environment,
            endpoint: result.endpoint
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

  const showViolentmonkeyStage = !continued && detectionState !== "detected";
  const synchronized = discovery?.synchronized === true || syncState === "synced";

  return (
    <Panel
      title="Extension"
      subtitle="Install, synchronize, and verify the Firefox Roll20 chat bridge."
    >
      <div className="stack">
        {showViolentmonkeyStage ? (
          <section className="stack" aria-labelledby="violentmonkey-stage-title">
            <h3 id="violentmonkey-stage-title">1. Install Violentmonkey</h3>
            <p className="muted">
              Violentmonkey keeps the Roll20 userscript installed and applies userscript updates
              without Firefox debugging mode.
            </p>
            <div className="inline-group">
              <a
                className="button"
                href={VIOLENTMONKEY_FIREFOX_URL}
                target="_blank"
                rel="noreferrer"
              >
                Install Violentmonkey
              </a>
              <button
                className="button button--secondary"
                onClick={() => {
                  setContinued(true);
                  void detect();
                }}
              >
                Continue
              </button>
            </div>
          </section>
        ) : detectionState === "checking" ? (
          <p className="muted">Checking for the Roll20 bridge userscript…</p>
        ) : detectionState === "not_detected" ? (
          <section className="stack" aria-labelledby="userscript-stage-title">
            <h3 id="userscript-stage-title">2. Install Roll20 Bridge</h3>
            <p className="muted">
              Violentmonkey will show an installation confirmation. Return here and reload or detect
              again after approving it. If the script is already listed in Violentmonkey, confirm
              that its toggle is enabled and install again to update it.
            </p>
            <div className="inline-group">
              <a className="button" href={installUrl} target="_blank" rel="noreferrer">
                Install or Update Roll20 Bridge
              </a>
              <button className="button button--secondary" onClick={() => void detect()}>
                Detect Again
              </button>
            </div>
          </section>
        ) : (
          <section className="stack" aria-labelledby="sync-stage-title">
            <h3 id="sync-stage-title">3. Synchronize Bridge</h3>
            <p className="muted">
              Userscript version {discovery?.version}. Syncing from this console replaces the active
              endpoint and credential in the one installed userscript.
            </p>
            <p className="muted">
              Synchronization only saves the bridge configuration and does not require Roll20 to be
              open. Roll20 status remains disconnected until an editor tab is opened or reloaded.
            </p>
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
                disabled={role !== "gm" || syncState === "syncing"}
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
              Test delivery is best-effort. Open or reload the Roll20 editor after installing or
              updating the userscript.
            </p>
          </section>
        )}
        {error ? <p className="field-error">{error}</p> : null}
      </div>
    </Panel>
  );
}
