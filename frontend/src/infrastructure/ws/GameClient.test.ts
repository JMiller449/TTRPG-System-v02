import { describe, expect, it } from "vitest";
import type { ServerEvent } from "@/domain/ipc";
import type { GameTransport, TransportUnsubscribe } from "@/infrastructure/transport/GameTransport";
import { ManagedGameClient } from "@/infrastructure/ws/GameClient";
import type { ProtocolApplicationRequest } from "@/infrastructure/ws/protocol";

function emptySnapshot() {
  return {
    sheets: [],
    persistentSheets: [],
    items: [],
    proficiencies: [],
    actions: [],
    formulas: [],
    conditionPresets: [],
    encounters: [],
    actionHistory: []
  };
}

class FakeTransport implements GameTransport {
  public protocolRequests: ProtocolApplicationRequest[] = [];
  public disconnectCount = 0;
  private handler: ((event: ServerEvent) => void) | null = null;

  constructor(private readonly connectError: Error | null = null) {}

  async connect(): Promise<void> {
    if (this.connectError) {
      throw this.connectError;
    }
  }

  disconnect(): void {
    this.disconnectCount += 1;
  }

  sendProtocolRequest(request: ProtocolApplicationRequest): void {
    this.protocolRequests.push(request);
  }

  onEvent(handler: (event: ServerEvent) => void): TransportUnsubscribe {
    this.handler = handler;
    return () => {
      if (this.handler === handler) {
        this.handler = null;
      }
    };
  }

  emit(event: ServerEvent): void {
    this.handler?.(event);
  }
}

describe("ManagedGameClient", () => {
  it("stays disconnected when the websocket transport fails", async () => {
    let factoryCalls = 0;
    const client = new ManagedGameClient({
      autoReconnect: false,
      transportFactory: () => {
        factoryCalls += 1;
        return new FakeTransport(new Error("ws failed"));
      }
    });
    const events: ServerEvent[] = [];
    client.onEvent((event) => events.push(event));

    await client.connect();

    expect(factoryCalls).toBe(1);
    expect(client.getConnectionState()).toEqual({
      status: "disconnected",
      error: "Failed to connect transport"
    });

    client.sendProtocolRequest({
      type: "get_roll20_bridge_status",
      request_id: "req-status"
    });

    expect(events).toEqual([
      {
        type: "error",
        requestId: "req-status",
        message: "Cannot send request while disconnected"
      }
    ]);
  });

  it("sends authenticate requests through the wrapper", async () => {
    const transport = new FakeTransport();
    const client = new ManagedGameClient({
      transportFactory: () => transport
    });

    await client.connect();
    client.authenticate("player", "player-token");

    expect(transport.protocolRequests).toEqual([
      {
        type: "authenticate",
        token: "player-token",
        request_id: transport.protocolRequests[0]?.request_id
      }
    ]);
  });

  it("reports missing role auth configuration instead of using a compiled fallback code", async () => {
    const transport = new FakeTransport();
    const client = new ManagedGameClient({
      transportFactory: () => transport
    });
    const events: ServerEvent[] = [];
    client.onEvent((event) => events.push(event));

    await client.connect();
    client.authenticate("gm");

    expect(transport.protocolRequests).toEqual([]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "error",
      message: "No DM authentication code is configured"
    });
  });

  it("sends protocol requests through the active transport", async () => {
    const transport = new FakeTransport();
    const client = new ManagedGameClient({
      transportFactory: () => transport
    });

    await client.connect();
    client.sendProtocolRequest({
      type: "delete_sheet_item_bridge",
      sheet_id: "sheet_1",
      relationship_id: "bridge_1",
      request_id: "req-1"
    });

    expect(transport.protocolRequests).toContainEqual({
      type: "delete_sheet_item_bridge",
      sheet_id: "sheet_1",
      relationship_id: "bridge_1",
      request_id: "req-1"
    });
  });

  it("emits an error when protocol requests are sent while disconnected", () => {
    const client = new ManagedGameClient({
      transportFactory: () => new FakeTransport()
    });
    const events: ServerEvent[] = [];
    client.onEvent((event) => events.push(event));

    client.sendProtocolRequest({
      type: "delete_sheet_item_bridge",
      sheet_id: "sheet_1",
      relationship_id: "bridge_1",
      request_id: "req-1"
    });

    expect(events).toEqual([
      {
        type: "error",
        requestId: "req-1",
        message: "Cannot send request while disconnected"
      }
    ]);
  });

  it("requests resync when an incremental state version skips ahead", async () => {
    const transport = new FakeTransport();
    const client = new ManagedGameClient({
      transportFactory: () => transport
    });
    const events: ServerEvent[] = [];
    client.onEvent((event) => events.push(event));

    await client.connect();
    transport.emit({
      type: "snapshot",
      snapshot: emptySnapshot(),
      stateVersion: 5,
      incremental: false
    });
    transport.emit({
      type: "snapshot",
      snapshot: emptySnapshot(),
      stateVersion: 7,
      incremental: true
    });

    expect(events).toHaveLength(2);
    expect(events[0]?.type).toBe("snapshot");
    expect(events[1]).toEqual({
      type: "sync_recovery",
      requestId: transport.protocolRequests[0]?.request_id,
      lastSeenVersion: 5,
      receivedVersion: 7
    });
    expect(transport.protocolRequests[0]?.type).toBe("resync_state");
    if (transport.protocolRequests[0]?.type !== "resync_state") {
      throw new Error("Expected resync_state request");
    }
    expect(transport.protocolRequests[0].last_seen_version).toBe(5);

    transport.emit({
      type: "snapshot",
      snapshot: emptySnapshot(),
      stateVersion: 7,
      incremental: false,
      requestId: transport.protocolRequests[0].request_id ?? undefined
    });

    expect(events.at(-1)).toMatchObject({
      type: "snapshot",
      stateVersion: 7,
      requestId: transport.protocolRequests[0].request_id
    });
  });

  it("schedules websocket reconnects with backoff and re-authenticates after a dropped connection", async () => {
    const transports: FakeTransport[] = [];
    const scheduledReconnects: Array<{ delayMs: number; callback: () => void; canceled: boolean }> =
      [];
    const connectionStates: unknown[] = [];
    const events: ServerEvent[] = [];
    const client = new ManagedGameClient({
      reconnectDelaysMs: [10, 25],
      reconnectScheduler: (callback, delayMs) => {
        const scheduled = { delayMs, callback, canceled: false };
        scheduledReconnects.push(scheduled);
        return () => {
          scheduled.canceled = true;
        };
      },
      transportFactory: () => {
        const transport = new FakeTransport();
        transports.push(transport);
        return transport;
      }
    });
    client.onConnectionState((state) => connectionStates.push(state));
    client.onEvent((event) => events.push(event));

    await client.connect();
    client.authenticate("player", "player-token");
    transports[0]?.emit({
      type: "snapshot",
      snapshot: emptySnapshot(),
      stateVersion: 5,
      incremental: false
    });
    transports[0]?.emit({ type: "connection_lost", message: "Connection closed" });

    expect(scheduledReconnects).toHaveLength(1);
    expect(scheduledReconnects[0]).toMatchObject({ delayMs: 10, canceled: false });
    expect(client.getConnectionState()).toEqual({
      status: "connecting",
      error: "Connection closed. Reconnecting in 10ms..."
    });

    scheduledReconnects[0]?.callback();
    await Promise.resolve();
    await Promise.resolve();

    expect(transports).toHaveLength(2);
    expect(client.getConnectionState()).toMatchObject({
      status: "connected",
      error: undefined
    });
    expect(transports[1]?.protocolRequests).toHaveLength(1);
    expect(transports[1]?.protocolRequests[0]).toMatchObject({
      type: "authenticate",
      token: "player-token"
    });

    transports[1]?.emit({
      type: "snapshot",
      snapshot: emptySnapshot(),
      stateVersion: 20,
      incremental: false
    });
    transports[1]?.emit({
      type: "snapshot",
      snapshot: emptySnapshot(),
      stateVersion: 21,
      incremental: true
    });

    expect(events.filter((event) => event.type === "sync_recovery")).toHaveLength(0);
    expect(connectionStates).toContainEqual({
      status: "connecting",
      error: "Connection closed. Reconnecting in 10ms..."
    });
  });

  it("continues reconnect backoff after retry failures", async () => {
    const scheduledReconnects: Array<{ delayMs: number; callback: () => void }> = [];
    const transports: FakeTransport[] = [];
    let factoryCalls = 0;
    const client = new ManagedGameClient({
      reconnectDelaysMs: [5, 15],
      reconnectScheduler: (callback, delayMs) => {
        scheduledReconnects.push({ delayMs, callback });
        return () => undefined;
      },
      transportFactory: () => {
        factoryCalls += 1;
        if (factoryCalls === 2) {
          const transport = new FakeTransport(new Error("retry failed"));
          transports.push(transport);
          return transport;
        }
        const transport = new FakeTransport();
        transports.push(transport);
        return transport;
      }
    });

    await client.connect();
    expect(factoryCalls).toBe(1);

    transports[0]?.emit({ type: "connection_lost", message: "Connection closed" });

    expect(scheduledReconnects[0]?.delayMs).toBe(5);
    scheduledReconnects[0]?.callback();
    await Promise.resolve();
    await Promise.resolve();

    expect(factoryCalls).toBe(2);
    expect(scheduledReconnects[1]?.delayMs).toBe(15);
    expect(client.getConnectionState()).toEqual({
      status: "connecting",
      error: "Failed to reconnect transport. Reconnecting in 15ms..."
    });

    scheduledReconnects[1]?.callback();
    await Promise.resolve();
    await Promise.resolve();

    expect(factoryCalls).toBe(3);
    expect(client.getConnectionState()).toMatchObject({
      status: "connected",
      error: undefined
    });
  });

  it("re-authenticates on reconnect after a successful auth attempt", async () => {
    const transport = new FakeTransport();
    const client = new ManagedGameClient({
      transportFactory: () => transport
    });

    await client.connect();
    client.authenticate("gm", "dm-token");
    client.disconnect();
    await client.connect();

    expect(transport.protocolRequests).toHaveLength(2);
    expect(transport.protocolRequests[0]).toMatchObject({
      type: "authenticate",
      token: "dm-token"
    });
    expect(transport.protocolRequests[1]).toMatchObject({
      type: "authenticate",
      token: "dm-token"
    });
  });

  it("clears stored auth when auth fails or the session ends", async () => {
    const transport = new FakeTransport();
    const client = new ManagedGameClient({
      transportFactory: () => transport
    });
    const events: ServerEvent[] = [];
    client.onEvent((event) => events.push(event));

    await client.connect();
    client.authenticate("player", "bad-token");
    transport.emit({
      type: "authenticated",
      authenticated: false,
      role: null,
      reason: "Invalid player or DM code."
    });
    client.disconnect();
    await client.connect();

    expect(transport.protocolRequests).toHaveLength(1);

    client.authenticate("player", "good-token");
    client.endSession();
    await client.connect();

    expect(transport.disconnectCount).toBeGreaterThanOrEqual(2);
    expect(events.at(-1)).toEqual({
      type: "authenticated",
      authenticated: false,
      role: null
    });
    expect(transport.protocolRequests).toHaveLength(2);
    expect(transport.protocolRequests[1]).toMatchObject({
      type: "authenticate",
      token: "good-token"
    });
  });
});
