// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  discoverBridgeUserscript,
  synchronizeBridgeUserscript
} from "@/features/extension/bridgeUserscriptChannel";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("bridgeUserscriptChannel", () => {
  it("discovers through a JSON custom event across the userscript content boundary", async () => {
    const handleRequest = (event: Event): void => {
      if (!(event instanceof CustomEvent) || typeof event.detail !== "string") {
        return;
      }
      const request = JSON.parse(event.detail) as { nonce: string; type: string };
      if (request.type !== "discover") {
        return;
      }
      document.dispatchEvent(
        new CustomEvent("ttrpg-roll20-bridge:response", {
          detail: JSON.stringify({
            channel: "ttrpg-roll20-bridge",
            type: "discovered",
            nonce: request.nonce,
            version: "1.0.1",
            synchronized: false,
            environment: null,
            endpoint: null,
            bindingKey: null,
            bindingLabel: null
          })
        })
      );
    };
    document.addEventListener("ttrpg-roll20-bridge:request", handleRequest);

    await expect(discoverBridgeUserscript()).resolves.toMatchObject({
      version: "1.0.1",
      synchronized: false
    });

    document.removeEventListener("ttrpg-roll20-bridge:request", handleRequest);
  });

  it("accepts a postMessage reply with a null source from extension code", async () => {
    vi.spyOn(window, "postMessage").mockImplementation((message) => {
      const request = message as { nonce: string; type: string };
      if (request.type === "discover") {
        window.dispatchEvent(
          new MessageEvent("message", {
            source: null,
            origin: window.location.origin,
            data: {
              channel: "ttrpg-roll20-bridge",
              type: "discovered",
              nonce: request.nonce,
              version: "1.0.0",
              synchronized: false,
              environment: null,
              endpoint: null,
              bindingKey: null,
              bindingLabel: null
            }
          })
        );
      }
    });

    await expect(discoverBridgeUserscript()).resolves.toMatchObject({ version: "1.0.0" });
  });

  it("discovers the installed userscript with a matching nonce", async () => {
    vi.spyOn(window, "postMessage").mockImplementation((message) => {
      const request = message as { nonce: string; type: string };
      if (request.type === "discover") {
        window.dispatchEvent(
          new MessageEvent("message", {
            source: window,
            origin: window.location.origin,
            data: {
              channel: "ttrpg-roll20-bridge",
              type: "discovered",
              nonce: request.nonce,
              version: "1.0.0",
              synchronized: false,
              environment: null,
              endpoint: null,
              bindingKey: null,
              bindingLabel: null
            }
          })
        );
      }
    });

    await expect(discoverBridgeUserscript()).resolves.toMatchObject({
      version: "1.0.0",
      synchronized: false,
      environment: null,
      endpoint: null
    });
  });

  it("retries discovery when the userscript listener starts after the page", async () => {
    vi.useFakeTimers();
    let attempts = 0;
    vi.spyOn(window, "postMessage").mockImplementation((message) => {
      const request = message as { nonce: string; type: string };
      if (request.type !== "discover") {
        return;
      }
      attempts += 1;
      if (attempts !== 2) {
        return;
      }
      window.dispatchEvent(
        new MessageEvent("message", {
          source: window,
          origin: window.location.origin,
          data: {
            channel: "ttrpg-roll20-bridge",
            type: "discovered",
            nonce: request.nonce,
            version: "1.0.1",
            synchronized: true,
            environment: "development",
            endpoint: "ws://127.0.0.1:6767/ws/chat",
            bindingKey: "instance:hero-1",
            bindingLabel: "Hero"
          }
        })
      );
    });

    const pending = discoverBridgeUserscript(1000);
    expect(attempts).toBe(1);
    await vi.advanceTimersByTimeAsync(200);

    await expect(pending).resolves.toMatchObject({
      version: "1.0.1",
      synchronized: true
    });
    expect(attempts).toBe(2);
  });

  it("passes the credential only in the sync request and returns a non-secret ack", async () => {
    const posted: unknown[] = [];
    vi.spyOn(window, "postMessage").mockImplementation((message) => {
      posted.push(message);
      const request = message as { nonce: string; type: string };
      if (request.type === "sync") {
        window.dispatchEvent(
          new MessageEvent("message", {
            source: window,
            origin: window.location.origin,
            data: {
              channel: "ttrpg-roll20-bridge",
              type: "synced",
              nonce: request.nonce,
              version: "1.0.0",
              environment: "development",
              endpoint: "ws://127.0.0.1:6767/ws/chat",
              bindingKey: "instance:hero-1",
              bindingLabel: "Hero"
            }
          })
        );
      }
    });

    const result = await synchronizeBridgeUserscript({
      discoveryNonce: "nonce-1",
      endpoint: "ws://127.0.0.1:6767/ws/chat",
      environment: "development",
      bridgeAuthToken: "signed-bridge-token",
      bindingKey: "instance:hero-1",
      bindingLabel: "Hero"
    });

    expect(posted).toContainEqual(
      expect.objectContaining({
        bridgeAuthToken: "signed-bridge-token",
        bindingKey: "instance:hero-1"
      })
    );
    expect(result).toEqual({
      version: "1.0.0",
      environment: "development",
      endpoint: "ws://127.0.0.1:6767/ws/chat",
      bindingKey: "instance:hero-1",
      bindingLabel: "Hero"
    });
    expect(result).not.toHaveProperty("bridgeAuthToken");
  });

  it("returns null when no userscript answers discovery", async () => {
    vi.useFakeTimers();
    vi.spyOn(window, "postMessage").mockImplementation(() => undefined);
    const pending = discoverBridgeUserscript(20);
    await vi.advanceTimersByTimeAsync(20);
    await expect(pending).resolves.toBeNull();
  });
});
