import { makeId } from "@/shared/utils/id";

const CHANNEL = "ttrpg-roll20-bridge";
const REQUEST_EVENT = `${CHANNEL}:request`;
const RESPONSE_EVENT = `${CHANNEL}:response`;
const DEFAULT_TIMEOUT_MS = 2000;
const DISCOVERY_RETRY_MS = 200;

export interface UserscriptDiscovery {
  nonce: string;
  version: string;
  synchronized: boolean;
  environment: "development" | "production" | null;
  endpoint: string | null;
  bindingKey: string | null;
  bindingLabel: string | null;
}

export interface UserscriptSyncResult {
  version: string;
  environment: "development" | "production";
  endpoint: string;
  bindingKey: string;
  bindingLabel: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isEnvironment(value: unknown): value is "development" | "production" {
  return value === "development" || value === "production";
}

function isChannelPayload(value: unknown, nonce: string): value is Record<string, unknown> {
  return isRecord(value) && value.channel === CHANNEL && value.nonce === nonce;
}

function messagePayload(event: MessageEvent, nonce: string): Record<string, unknown> | null {
  if (
    event.origin !== window.location.origin ||
    (event.source !== window && event.source !== null) ||
    !isChannelPayload(event.data, nonce)
  ) {
    return null;
  }
  return event.data;
}

function customEventPayload(event: Event, nonce: string): Record<string, unknown> | null {
  const detail = (event as CustomEvent<unknown>).detail;
  if (typeof detail !== "string") {
    return null;
  }
  try {
    const payload: unknown = JSON.parse(detail);
    return isChannelPayload(payload, nonce) ? payload : null;
  } catch {
    return null;
  }
}

function sendToUserscript(payload: Record<string, unknown>): void {
  const message = { channel: CHANNEL, ...payload };
  document.dispatchEvent(
    new CustomEvent(REQUEST_EVENT, {
      detail: JSON.stringify(message)
    })
  );
  // Keep postMessage for compatibility with userscript version 1.0.0.
  window.postMessage(message, window.location.origin);
}

export function discoverBridgeUserscript(
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<UserscriptDiscovery | null> {
  const nonce = makeId("bridge-discovery");
  return new Promise((resolve) => {
    const cleanup = (): void => {
      window.clearTimeout(timeoutId);
      window.clearInterval(retryId);
      window.removeEventListener("message", handleMessage);
      document.removeEventListener(RESPONSE_EVENT, handleCustomEvent);
    };
    const handlePayload = (payload: Record<string, unknown> | null): void => {
      if (!payload || payload.type !== "discovered") {
        return;
      }
      if (
        typeof payload.version !== "string" ||
        typeof payload.synchronized !== "boolean" ||
        !(payload.environment === null || isEnvironment(payload.environment)) ||
        !(payload.endpoint === null || typeof payload.endpoint === "string") ||
        !(payload.bindingKey === null || typeof payload.bindingKey === "string") ||
        !(payload.bindingLabel === null || typeof payload.bindingLabel === "string")
      ) {
        return;
      }
      cleanup();
      resolve({
        nonce,
        version: payload.version,
        synchronized: payload.synchronized,
        environment: payload.environment,
        endpoint: payload.endpoint,
        bindingKey: payload.bindingKey,
        bindingLabel: payload.bindingLabel
      });
    };
    const handleMessage = (event: MessageEvent): void => {
      handlePayload(messagePayload(event, nonce));
    };
    const handleCustomEvent = (event: Event): void => {
      handlePayload(customEventPayload(event, nonce));
    };
    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeoutMs);
    const sendDiscovery = (): void => {
      sendToUserscript({ type: "discover", nonce });
    };
    const retryId = window.setInterval(sendDiscovery, DISCOVERY_RETRY_MS);

    window.addEventListener("message", handleMessage);
    document.addEventListener(RESPONSE_EVENT, handleCustomEvent);
    sendDiscovery();
  });
}

export function synchronizeBridgeUserscript({
  discoveryNonce,
  endpoint,
  environment,
  bridgeAuthToken,
  bindingKey,
  bindingLabel,
  timeoutMs = DEFAULT_TIMEOUT_MS
}: {
  discoveryNonce: string;
  endpoint: string;
  environment: "development" | "production";
  bridgeAuthToken: string;
  bindingKey: string;
  bindingLabel: string;
  timeoutMs?: number;
}): Promise<UserscriptSyncResult> {
  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("message", handleMessage);
      document.removeEventListener(RESPONSE_EVENT, handleCustomEvent);
    };
    const handlePayload = (payload: Record<string, unknown> | null): void => {
      if (!payload) {
        return;
      }
      if (payload.type === "sync_failed") {
        cleanup();
        reject(new Error("The userscript rejected the bridge configuration."));
        return;
      }
      if (
        payload.type !== "synced" ||
        typeof payload.version !== "string" ||
        !isEnvironment(payload.environment) ||
        typeof payload.endpoint !== "string" ||
        typeof payload.bindingKey !== "string" ||
        typeof payload.bindingLabel !== "string"
      ) {
        return;
      }
      cleanup();
      resolve({
        version: payload.version,
        environment: payload.environment,
        endpoint: payload.endpoint,
        bindingKey: payload.bindingKey,
        bindingLabel: payload.bindingLabel
      });
    };
    const handleMessage = (event: MessageEvent): void => {
      handlePayload(messagePayload(event, discoveryNonce));
    };
    const handleCustomEvent = (event: Event): void => {
      handlePayload(customEventPayload(event, discoveryNonce));
    };
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for the userscript to confirm synchronization."));
    }, timeoutMs);

    window.addEventListener("message", handleMessage);
    document.addEventListener(RESPONSE_EVENT, handleCustomEvent);
    sendToUserscript({
      type: "sync",
      nonce: discoveryNonce,
      endpoint,
      environment,
      bridgeAuthToken,
      bindingKey,
      bindingLabel
    });
  });
}
