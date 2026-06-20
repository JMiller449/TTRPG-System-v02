import { describe, expect, it } from "vitest";
import type { ClientIntent, ServerEvent } from "@/domain/ipc";
import type { GameTransport, TransportUnsubscribe } from "@/infrastructure/transport/GameTransport";
import { ManagedGameClient } from "@/infrastructure/ws/GameClient";
import type { ProtocolApplicationRequest } from "@/infrastructure/ws/protocol";

class FakeTransport implements GameTransport {
  public protocolRequests: ProtocolApplicationRequest[] = [];
  public sentIntents: ClientIntent[] = [];
  public disconnectCount = 0;
  private handler: ((event: ServerEvent) => void) | null = null;

  constructor(
    public readonly mode: "mock" | "ws" = "ws",
    private readonly connectError: Error | null = null
  ) {}

  async connect(): Promise<void> {
    if (this.connectError) {
      throw this.connectError;
    }
  }

  disconnect(): void {
    this.disconnectCount += 1;
  }

  sendIntent(intent: ClientIntent): void {
    this.sentIntents.push(intent);
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
  it("does not fall back to mock transport when websocket connection fails", async () => {
    const requestedModes: string[] = [];
    const client = new ManagedGameClient({
      preferredMode: "ws",
      transportFactory: (mode) => {
        requestedModes.push(mode);
        return new FakeTransport(mode, new Error("ws failed"));
      }
    });
    const events: ServerEvent[] = [];
    client.onEvent((event) => events.push(event));

    await client.connect();

    expect(requestedModes).toEqual(["ws"]);
    expect(client.getConnectionState()).toEqual({
      status: "disconnected",
      transport: "ws",
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

  it("uses mock transport only when explicitly requested", async () => {
    const requestedModes: string[] = [];
    const mockTransport = new FakeTransport("mock");
    const client = new ManagedGameClient({
      preferredMode: "mock",
      transportFactory: (mode) => {
        requestedModes.push(mode);
        return mockTransport;
      }
    });

    await client.connect();

    expect(requestedModes).toEqual(["mock"]);
    expect(client.getConnectionState()).toMatchObject({
      status: "connected",
      transport: "mock"
    });
  });

  it("sends authenticate requests through the wrapper", async () => {
    const transport = new FakeTransport();
    const client = new ManagedGameClient({
      preferredMode: "ws",
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

  it("sends protocol requests through the active transport", async () => {
    const transport = new FakeTransport();
    const client = new ManagedGameClient({
      preferredMode: "ws",
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
      preferredMode: "ws",
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
      preferredMode: "ws",
      transportFactory: () => transport
    });
    const events: ServerEvent[] = [];
    client.onEvent((event) => events.push(event));

    await client.connect();
    transport.emit({
      type: "snapshot",
      snapshot: {
        sheets: [],
        persistentSheets: [],
        items: [],
        actions: [],
        formulas: [],
        conditionPresets: [],
        sheetPresentation: [],
        persistentSheetPresentation: [],
        encounters: [],
        actionHistory: [],
        activeSheetId: null
      },
      stateVersion: 5,
      incremental: false
    });
    transport.emit({
      type: "snapshot",
      snapshot: {
        sheets: [],
        persistentSheets: [],
        items: [],
        actions: [],
        formulas: [],
        conditionPresets: [],
        sheetPresentation: [],
        persistentSheetPresentation: [],
        encounters: [],
        actionHistory: [],
        activeSheetId: null
      },
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
      snapshot: {
        sheets: [],
        persistentSheets: [],
        items: [],
        actions: [],
        formulas: [],
        conditionPresets: [],
        sheetPresentation: [],
        persistentSheetPresentation: [],
        encounters: [],
        actionHistory: [],
        activeSheetId: null
      },
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

  it("re-authenticates on reconnect after a successful auth attempt", async () => {
    const transport = new FakeTransport();
    const client = new ManagedGameClient({
      preferredMode: "ws",
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
      preferredMode: "ws",
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
