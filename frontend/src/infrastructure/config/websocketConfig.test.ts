import { describe, expect, it } from "vitest";
import {
  bridgeEnvironment,
  deriveRoll20BridgeUrl,
  resolveApplicationWebSocketUrl,
  userscriptInstallUrl
} from "@/infrastructure/config/websocketConfig";

describe("websocketConfig", () => {
  it("derives local and hosted Roll20 bridge endpoints from the app socket", () => {
    expect(deriveRoll20BridgeUrl("ws://127.0.0.1:6767/ws")).toBe("ws://127.0.0.1:6767/ws/chat");
    expect(deriveRoll20BridgeUrl("wss://bossadapt.org/ttrpg/ws")).toBe(
      "wss://bossadapt.org/ttrpg/ws/chat"
    );
  });

  it("rejects non-WebSocket and non-terminal ws paths", () => {
    expect(() => resolveApplicationWebSocketUrl("https://example.com/ws")).toThrow();
    expect(() => deriveRoll20BridgeUrl("wss://example.com/ws/other")).toThrow();
  });

  it("identifies environments and builds base-aware install URLs", () => {
    expect(bridgeEnvironment("ws://localhost:6767/ws/chat")).toBe("development");
    expect(bridgeEnvironment("wss://bossadapt.org/ttrpg/ws/chat")).toBe("production");
    expect(userscriptInstallUrl("http://localhost:5173", "/")).toBe(
      "http://localhost:5173/roll20-bridge.user.js"
    );
    expect(userscriptInstallUrl("https://bossadapt.org", "/ttrpg/")).toBe(
      "https://bossadapt.org/ttrpg/roll20-bridge.user.js"
    );
  });
});
