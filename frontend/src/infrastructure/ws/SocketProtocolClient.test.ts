import { afterEach, describe, expect, it, vi } from "vitest";
import type { ServerEvent } from "@/domain/ipc";
import { SocketProtocolClient } from "@/infrastructure/ws/SocketProtocolClient";

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  static instances: FakeWebSocket[] = [];

  readonly listeners = new Map<string, Set<(event: any) => void>>();
  readonly sentMessages: string[] = [];
  readyState = FakeWebSocket.CONNECTING;

  constructor(public readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: (event: any) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatch("close", { type: "close" });
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.dispatch("open", { type: "open" });
  }

  error(): void {
    this.dispatch("error", { type: "error" });
  }

  message(data: string): void {
    this.dispatch("message", { data });
  }

  private dispatch(type: string, event: any): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

describe("SocketProtocolClient", () => {
  const originalWebSocket = globalThis.WebSocket;

  afterEach(() => {
    FakeWebSocket.instances = [];
    vi.unstubAllGlobals();
    globalThis.WebSocket = originalWebSocket;
  });

  it("parses protocol snapshots into internal events", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const client = new SocketProtocolClient("ws://example.test/ws");
    const events: ServerEvent[] = [];
    client.onEvent((event) => events.push(event));

    const connectPromise = client.connect();
    const socket = FakeWebSocket.instances[0];
    if (!socket) {
      throw new Error("Expected fake websocket instance");
    }

    socket.open();
    await connectPromise;
    socket.message(
      JSON.stringify({
        response_id: null,
        state: {
          sheets: {},
          instanced_sheets: {},
          formulas: {},
          actions: {},
          items: {},
          proficiencies: {}
        },
        state_version: 0,
        type: "state_snapshot",
        request_id: null
      })
    );

    expect(events).toEqual([
      {
        type: "snapshot",
        snapshot: {
          sheets: [],
          persistentSheets: [],
          items: [],
          actions: [],
          formulas: [],
          sheetPresentation: [],
          persistentSheetPresentation: [],
          encounters: [],
          rollLog: [],
          activeSheetId: null
        },
        stateVersion: 0,
        incremental: false
      }
    ]);
  });

  it("applies patches using internal protocol state", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const client = new SocketProtocolClient("ws://example.test/ws");
    const events: ServerEvent[] = [];
    client.onEvent((event) => events.push(event));

    const connectPromise = client.connect();
    const socket = FakeWebSocket.instances[0];
    if (!socket) {
      throw new Error("Expected fake websocket instance");
    }

    socket.open();
    await connectPromise;

    socket.message(
      JSON.stringify({
        response_id: null,
        state: {
          sheets: {},
          instanced_sheets: {},
          formulas: {},
          actions: {},
          items: {},
          proficiencies: {}
        },
        state_version: 0,
        type: "state_snapshot",
        request_id: null
      })
    );
    socket.message(
      JSON.stringify({
        response_id: null,
        ops: [
          {
            op: "set",
            path: "/sheets/template_1",
            value: {
              id: "template_1",
              name: "Goblin",
              dm_only: true,
              xp_given_when_slayed: 10,
              xp_cap: "",
              proficiencies: {},
              items: {},
              stats: {
                strength: 1,
                dexterity: 1,
                constitution: 1,
                perception: 1,
                arcane: 1,
                will: 1,
                lifting: { aliases: [], text: "1" },
                carry_weight: { aliases: [], text: "1" },
                acrobatics: { aliases: [], text: "1" },
                stamina: { aliases: [], text: "1" },
                reaction_time: { aliases: [], text: "1" },
                health: { aliases: [], text: "1" },
                endurance: { aliases: [], text: "1" },
                pain_tolerance: { aliases: [], text: "1" },
                sight_distance: { aliases: [], text: "1" },
                intuition: { aliases: [], text: "1" },
                registration: { aliases: [], text: "1" },
                mana: { aliases: [], text: "1" },
                control: { aliases: [], text: "1" },
                sensitivity: { aliases: [], text: "1" },
                charisma: { aliases: [], text: "1" },
                mental_fortitude: { aliases: [], text: "1" },
                courage: { aliases: [], text: "1" }
              },
              slayed_record: {},
              actions: {}
            }
          }
        ],
        state_version: 1,
        type: "state_patch",
        request_id: "req-1"
      })
    );

    const lastEvent = events.at(-1);
    expect(lastEvent?.type).toBe("snapshot");
    if (lastEvent?.type !== "snapshot") {
      throw new Error("Expected snapshot event");
    }
    expect(lastEvent.incremental).toBe(true);
    expect(lastEvent.stateVersion).toBe(1);
    expect(lastEvent.snapshot.sheets[0]?.id).toBe("template_1");
  });

  it("surfaces invalid payloads explicitly", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const client = new SocketProtocolClient("ws://example.test/ws");
    const events: ServerEvent[] = [];
    client.onEvent((event) => events.push(event));

    const connectPromise = client.connect();
    const socket = FakeWebSocket.instances[0];
    if (!socket) {
      throw new Error("Expected fake websocket instance");
    }

    socket.open();
    await connectPromise;
    socket.message("not json");

    expect(events).toEqual([{ type: "error", message: "Invalid server payload" }]);
  });
});
