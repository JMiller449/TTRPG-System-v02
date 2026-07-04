import { afterEach, describe, expect, it, vi } from "vitest";
import type { ServerEvent } from "@/domain/ipc";
import { SocketProtocolClient } from "@/infrastructure/ws/SocketProtocolClient";

type FakeWebSocketEvent = { type: string } | { data: string };

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  static instances: FakeWebSocket[] = [];

  readonly listeners = new Map<string, Set<(event: FakeWebSocketEvent) => void>>();
  readonly sentMessages: string[] = [];
  readyState = FakeWebSocket.CONNECTING;

  constructor(public readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: (event: FakeWebSocketEvent) => void): void {
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

  private dispatch(type: string, event: FakeWebSocketEvent): void {
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
          proficiencies: [],
          actions: [],
          formulas: [],
          attributes: [],
          augmentations: [],
          standaloneEffects: [],
          standaloneEffectApplications: [],
          conditionPresets: [],
          activeConditions: [],
          encounters: [],
          actionHistory: []
        },
        stateVersion: 0,
        incremental: false,
        requestId: undefined
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

  it("keeps rapid ordered patches consistent with their request and state versions", async () => {
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
            op: "add",
            path: "/items/item_1",
            value: {
              id: "item_1",
              name: "Focus Ring",
              description: "",
              price: "10",
              weight: "1",
              augmentation_templates: []
            }
          }
        ],
        state_version: 1,
        type: "state_patch",
        request_id: "req-create"
      })
    );
    socket.message(
      JSON.stringify({
        response_id: null,
        ops: [
          {
            op: "set",
            path: "/items/item_1/name",
            value: "Greater Focus Ring"
          }
        ],
        state_version: 2,
        type: "state_patch",
        request_id: "req-update"
      })
    );
    socket.message(
      JSON.stringify({
        response_id: null,
        ops: [
          {
            op: "remove",
            path: "/items/item_1"
          }
        ],
        state_version: 3,
        type: "state_patch",
        request_id: "req-delete"
      })
    );

    const snapshots = events.filter(
      (event): event is Extract<ServerEvent, { type: "snapshot" }> => event.type === "snapshot"
    );
    expect(snapshots.map((event) => event.stateVersion)).toEqual([0, 1, 2, 3]);
    expect(snapshots.slice(1).map((event) => event.requestId)).toEqual([
      "req-create",
      "req-update",
      "req-delete"
    ]);
    expect(snapshots[1]?.snapshot.items[0]?.name).toBe("Focus Ring");
    expect(snapshots[2]?.snapshot.items[0]?.name).toBe("Greater Focus Ring");
    expect(snapshots[3]?.snapshot.items).toEqual([]);
  });

  it("emits connection_lost when an open socket closes unexpectedly", async () => {
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
    socket.close();

    expect(events).toEqual([{ type: "connection_lost", message: "Connection closed" }]);

    const reconnectPromise = client.connect();
    expect(FakeWebSocket.instances).toHaveLength(2);
    FakeWebSocket.instances[1]?.open();
    await reconnectPromise;
  });

  it("does not emit connection_lost for intentional disconnects", async () => {
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
    client.disconnect();

    expect(events).toEqual([]);
  });
});
