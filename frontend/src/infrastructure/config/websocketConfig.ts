export const DEFAULT_APPLICATION_WS_URL = "ws://127.0.0.1:6767/ws";

export function resolveApplicationWebSocketUrl(configuredUrl?: string): string {
  const value = configuredUrl?.trim() || DEFAULT_APPLICATION_WS_URL;
  const parsed = new URL(value);
  if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
    throw new Error("Application WebSocket URL must use ws:// or wss://.");
  }
  return parsed.toString();
}

export function deriveRoll20BridgeUrl(applicationUrl: string): string {
  const parsed = new URL(applicationUrl);
  if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
    throw new Error("Application WebSocket URL must use ws:// or wss://.");
  }
  if (!/\/ws\/?$/.test(parsed.pathname)) {
    throw new Error("Application WebSocket URL must end in /ws.");
  }
  parsed.pathname = parsed.pathname.replace(/\/ws\/?$/, "/ws/chat");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

export function bridgeEnvironment(endpoint: string): "development" | "production" {
  const parsed = new URL(endpoint);
  return parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost"
    ? "development"
    : "production";
}

export function userscriptInstallUrl(origin: string, baseUrl: string): string {
  const base = new URL(baseUrl, origin);
  return new URL("roll20-bridge.user.js", base).toString();
}
