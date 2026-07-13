import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const userscriptPath = fileURLToPath(
  new URL("../../../../violentmonkey_extension/roll20-bridge.user.js", import.meta.url)
);
const source = readFileSync(userscriptPath, "utf8");

describe("roll20 bridge userscript artifact", () => {
  it("keeps install/update metadata first and excludes legacy extension configuration", () => {
    expect(source.split("\n")[0].trimEnd()).toBe("// ==UserScript==");
    expect(source).toContain("// @version     1.0.1");
    expect(source).toContain("// @downloadURL https://bossadapt.org/ttrpg/roll20-bridge.user.js");
    expect(source).toContain("// @grant       GM_getValues");
    expect(source).toContain("// @grant       GM_setValues");
    expect(source).not.toContain("browser.storage");
    expect(source).not.toContain("DEFAULT_SERVICE_AUTH_CODE");
    expect(source).not.toContain("roll20_firefox_extension");
  });

  it("runs frontend discovery and replaces one stored configuration", async () => {
    const listeners = new Map<string, (event: Record<string, unknown>) => void>();
    const documentListeners = new Map<string, (event: Record<string, unknown>) => void>();
    const posted: Array<Record<string, unknown>> = [];
    let storedConfig: unknown = null;
    const location = {
      protocol: "http:",
      hostname: "127.0.0.1",
      port: "5173",
      pathname: "/",
      origin: "http://127.0.0.1:5173"
    };
    const windowObject = {
      location,
      addEventListener: (
        type: string,
        listener: (event: Record<string, unknown>) => Promise<void>
      ) => {
        listeners.set(type, listener);
      },
      postMessage: (payload: Record<string, unknown>) => posted.push(payload)
    };
    const documentObject = {
      addEventListener: (type: string, listener: (event: Record<string, unknown>) => void) => {
        documentListeners.set(type, listener);
      },
      dispatchEvent: () => true
    };

    vm.runInNewContext(source, {
      URL,
      CustomEvent: class {
        constructor(
          readonly type: string,
          readonly options: Record<string, unknown>
        ) {}
      },
      console: { log: () => undefined },
      document: documentObject,
      window: windowObject,
      GM_getValues: async () => ({ bridgeConfig: storedConfig }),
      GM_setValues: async (values: { bridgeConfig: unknown }) => {
        storedConfig = values.bridgeConfig;
      },
      GM_addValueChangeListener: () => undefined
    });

    const listener = listeners.get("message");
    expect(listener).toBeDefined();
    await listener?.({
      source: windowObject,
      origin: location.origin,
      data: {
        channel: "ttrpg-roll20-bridge",
        type: "discover",
        nonce: "nonce-1"
      }
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await listener?.({
      source: windowObject,
      origin: location.origin,
      data: {
        channel: "ttrpg-roll20-bridge",
        type: "sync",
        nonce: "nonce-1",
        endpoint: "ws://127.0.0.1:6767/ws/chat",
        environment: "development",
        serviceAuthCode: "secret"
      }
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(storedConfig).toEqual({
      endpoint: "ws://127.0.0.1:6767/ws/chat",
      environment: "development",
      serviceAuthCode: "secret"
    });
    expect(posted.at(-1)).toEqual({
      channel: "ttrpg-roll20-bridge",
      type: "synced",
      nonce: "nonce-1",
      version: "1.0.1",
      synchronized: true,
      environment: "development",
      endpoint: "ws://127.0.0.1:6767/ws/chat"
    });
    expect(posted.at(-1)).not.toHaveProperty("serviceAuthCode");

    await listener?.({
      source: windowObject,
      origin: location.origin,
      data: {
        channel: "ttrpg-roll20-bridge",
        type: "discover",
        nonce: "nonce-2"
      }
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await listener?.({
      source: windowObject,
      origin: location.origin,
      data: {
        channel: "ttrpg-roll20-bridge",
        type: "sync",
        nonce: "nonce-2",
        endpoint: "ws://example.com/ws/chat",
        environment: "production",
        serviceAuthCode: "replacement"
      }
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(storedConfig).toEqual({
      endpoint: "ws://127.0.0.1:6767/ws/chat",
      environment: "development",
      serviceAuthCode: "secret"
    });
    expect(posted.at(-1)).toMatchObject({ type: "sync_failed", nonce: "nonce-2" });
  });

  it("serializes Roll20 delivery, reconnects transiently, and stops after replacement", async () => {
    type SocketListener = (event: Record<string, unknown>) => void;
    const sockets: FakeWebSocket[] = [];
    const scheduled: Array<() => void> = [];
    const clickedMessages: string[] = [];
    const chatInput = {
      value: "",
      focus: () => undefined,
      dispatchEvent: () => true
    };
    const sendButton = {
      click: () => clickedMessages.push(chatInput.value)
    };

    class FakeWebSocket {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;
      readonly listeners = new Map<string, SocketListener[]>();
      readonly sent: string[] = [];
      readyState = FakeWebSocket.CONNECTING;

      constructor(readonly url: string) {
        sockets.push(this);
      }

      addEventListener(type: string, listener: SocketListener): void {
        const entries = this.listeners.get(type) ?? [];
        entries.push(listener);
        this.listeners.set(type, entries);
      }

      send(payload: string): void {
        this.sent.push(payload);
      }

      close(): void {
        this.readyState = FakeWebSocket.CLOSED;
      }

      emit(type: string, event: Record<string, unknown> = {}): void {
        for (const listener of this.listeners.get(type) ?? []) {
          listener(event);
        }
      }
    }

    const windowObject = {
      location: {
        protocol: "https:",
        hostname: "app.roll20.net",
        port: "",
        pathname: "/editor/game",
        origin: "https://app.roll20.net"
      },
      setTimeout: (callback: () => void) => {
        scheduled.push(callback);
        return scheduled.length;
      },
      clearTimeout: () => undefined
    };

    vm.runInNewContext(source, {
      URL,
      Event: class {
        constructor(
          readonly type: string,
          readonly options: Record<string, unknown>
        ) {}
      },
      WebSocket: FakeWebSocket,
      console: { log: () => undefined },
      document: {
        querySelector: (selector: string) =>
          selector.includes("textarea") ? chatInput : sendButton
      },
      window: windowObject,
      GM_getValues: async () => ({
        bridgeConfig: {
          endpoint: "ws://127.0.0.1:6767/ws/chat",
          environment: "development",
          serviceAuthCode: "secret"
        }
      }),
      GM_setValues: async () => undefined,
      GM_addValueChangeListener: () => undefined
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const firstSocket = sockets[0];
    expect(firstSocket?.url).toBe("ws://127.0.0.1:6767/ws/chat");
    if (!firstSocket) {
      throw new Error("Expected the Roll20 bridge socket");
    }
    firstSocket.readyState = FakeWebSocket.OPEN;
    firstSocket.emit("open");
    expect(JSON.parse(firstSocket.sent[0] ?? "{}")).toEqual({
      type: "authenticate",
      token: "secret"
    });
    firstSocket.emit("message", {
      data: JSON.stringify({ type: "authenticate_response", authenticated: true, role: "service" })
    });
    firstSocket.emit("message", {
      data: JSON.stringify({ type: "chat_message", message_id: "one", message: "first" })
    });
    firstSocket.emit("message", {
      data: JSON.stringify({ type: "chat_message", message_id: "two", message: "second" })
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(clickedMessages).toEqual(["first", "second"]);
    expect(firstSocket.sent.map((payload) => JSON.parse(payload))).toContainEqual({
      type: "hello",
      source: "roll20_violentmonkey_userscript"
    });
    expect(firstSocket.sent.map((payload) => JSON.parse(payload))).toContainEqual({
      type: "chat_delivery",
      message_id: "two",
      success: true
    });

    firstSocket.emit("message", {
      data: JSON.stringify({ type: "chat_message", message_id: "stale", message: "stale" })
    });
    firstSocket.emit("close", { code: 1006, reason: "" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(clickedMessages).toEqual(["first", "second"]);
    expect(scheduled).toHaveLength(1);
    scheduled.shift()?.();
    expect(sockets).toHaveLength(2);
    const replacementSocket = sockets[1];
    replacementSocket?.emit("close", { code: 4001, reason: "bridge_replaced" });
    expect(scheduled).toHaveLength(0);
  });

  it("reports exact Roll20 DOM delivery failure reasons", async () => {
    async function deliveryReason({
      querySelector,
      DateObject = Date
    }: {
      querySelector: (selector: string) => unknown;
      DateObject?: { now(): number };
    }): Promise<string | undefined> {
      type SocketListener = (event: Record<string, unknown>) => void;
      let socket: FakeWebSocket | undefined;
      class FakeWebSocket {
        static readonly CONNECTING = 0;
        static readonly OPEN = 1;
        static readonly CLOSING = 2;
        static readonly CLOSED = 3;
        readonly listeners = new Map<string, SocketListener[]>();
        readonly sent: string[] = [];
        readyState = FakeWebSocket.CONNECTING;

        constructor() {
          socket = this;
        }

        addEventListener(type: string, listener: SocketListener): void {
          this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
        }

        send(payload: string): void {
          this.sent.push(payload);
        }

        close(): void {
          this.readyState = FakeWebSocket.CLOSED;
        }

        emit(type: string, event: Record<string, unknown> = {}): void {
          for (const listener of this.listeners.get(type) ?? []) {
            listener(event);
          }
        }
      }

      vm.runInNewContext(source, {
        URL,
        Date: DateObject,
        Event: class {
          constructor(
            readonly type: string,
            readonly options: Record<string, unknown>
          ) {}
        },
        WebSocket: FakeWebSocket,
        console: { log: () => undefined },
        document: { querySelector },
        window: {
          location: {
            protocol: "https:",
            hostname: "app.roll20.net",
            port: "",
            pathname: "/editor/game",
            origin: "https://app.roll20.net"
          },
          setTimeout: (callback: () => void) => {
            queueMicrotask(callback);
            return 1;
          },
          clearTimeout: () => undefined
        },
        GM_getValues: async () => ({
          bridgeConfig: {
            endpoint: "ws://127.0.0.1:6767/ws/chat",
            environment: "development",
            serviceAuthCode: "secret"
          }
        }),
        GM_setValues: async () => undefined,
        GM_addValueChangeListener: () => undefined
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (!socket) {
        throw new Error("Expected bridge socket");
      }
      socket.readyState = FakeWebSocket.OPEN;
      socket.emit("message", {
        data: JSON.stringify({ type: "authenticate_response", authenticated: true })
      });
      socket.emit("message", {
        data: JSON.stringify({ type: "chat_message", message_id: "failed", message: "roll" })
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      return socket.sent
        .map((payload) => JSON.parse(payload) as Record<string, unknown>)
        .find((payload) => payload.type === "chat_delivery")?.reason as string | undefined;
    }

    let now = 0;
    class ExpiringDate extends Date {
      static override now(): number {
        now += 10001;
        return now;
      }
    }
    await expect(
      deliveryReason({ querySelector: () => null, DateObject: ExpiringDate })
    ).resolves.toBe("chat_ui_not_found");
    await expect(
      deliveryReason({
        querySelector: (selector) =>
          selector.includes("textarea")
            ? {
                value: "",
                focus: () => {
                  throw new Error("focus");
                },
                dispatchEvent: () => true
              }
            : { click: () => undefined }
      })
    ).resolves.toBe("chat_input_failed");
    await expect(
      deliveryReason({
        querySelector: (selector) =>
          selector.includes("textarea")
            ? { value: "", focus: () => undefined, dispatchEvent: () => true }
            : {
                click: () => {
                  throw new Error("click");
                }
              }
      })
    ).resolves.toBe("chat_submit_failed");
    await expect(
      deliveryReason({
        querySelector: () => {
          throw new Error("unexpected");
        }
      })
    ).resolves.toBe("unknown");
  });

  it("contains the terminal and queue controls in the distributed artifact", () => {
    expect(source).toContain("BRIDGE_REPLACED_CLOSE_CODE = 4001");
    expect(source).toContain("terminalUntilConfigChange");
    expect(source).toContain("deliveryQueue = deliveryQueue.then");
    expect(source).toContain("generation === socketGeneration");
    expect(source).toContain('type: "chat_delivery"');
  });
});
