import type { ClientIntent, ServerEvent } from "@/domain/ipc";
import type { Role } from "@/domain/models";
import type { GameTransport, TransportUnsubscribe } from "@/infrastructure/transport/GameTransport";
import { MockGameTransport } from "@/infrastructure/transport/MockGameTransport";
import { WebSocketGameTransport } from "@/infrastructure/transport/WebSocketGameTransport";
import type { ProtocolApplicationRequest } from "@/infrastructure/ws/protocol";
import { makeId } from "@/shared/utils/id";

export type ClientTransportMode = "mock" | "ws";
export type ClientConnectionStatus = "disconnected" | "connecting" | "connected";

export interface ClientConnectionState {
  status: ClientConnectionStatus;
  transport: ClientTransportMode;
  error?: string;
}

export interface ManagedGameClientOptions {
  preferredMode?: ClientTransportMode;
  wsUrl?: string;
  transportFactory?: (mode: ClientTransportMode, wsUrl: string) => GameTransport;
}

type ConnectionListener = (state: ClientConnectionState) => void;
type EventListener = (event: ServerEvent) => void;

const DEFAULT_WS_URL = "ws://127.0.0.1:6767/ws";
const DEFAULT_PLAYER_AUTH_TOKEN = "change-me-player-code";
const DEFAULT_DM_AUTH_TOKEN = "change-me-dm-code";

function createTransport(mode: ClientTransportMode, wsUrl: string): GameTransport {
  if (mode === "ws") {
    return new WebSocketGameTransport(wsUrl);
  }
  return new MockGameTransport();
}

export class ManagedGameClient {
  private readonly listeners = new Set<EventListener>();
  private readonly connectionListeners = new Set<ConnectionListener>();
  private readonly preferredMode: ClientTransportMode;
  private readonly wsUrl: string;
  private readonly transportFactory: (mode: ClientTransportMode, wsUrl: string) => GameTransport;

  private transport: GameTransport | null = null;
  private transportUnsubscribe: TransportUnsubscribe | null = null;
  private authToken: string | null = null;
  private lastSeenStateVersion: number | null = null;
  private connectionState: ClientConnectionState;

  constructor(options: ManagedGameClientOptions = {}) {
    this.preferredMode = options.preferredMode ?? "ws";
    this.wsUrl = options.wsUrl ?? DEFAULT_WS_URL;
    this.transportFactory = options.transportFactory ?? createTransport;
    this.connectionState = {
      status: "disconnected",
      transport: this.preferredMode
    };
  }

  getConnectionState(): ClientConnectionState {
    return this.connectionState;
  }

  onEvent(listener: EventListener): TransportUnsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  onConnectionState(listener: ConnectionListener): TransportUnsubscribe {
    this.connectionListeners.add(listener);
    listener(this.connectionState);
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  async connect(): Promise<void> {
    this.updateConnectionState({
      ...this.connectionState,
      status: "connecting",
      error: undefined
    });

    try {
      let transport = this.transport;
      if (this.preferredMode === "ws" && transport?.mode !== "ws") {
        transport = this.transportFactory("ws", this.wsUrl);
        this.bindTransport(transport);
      } else if (!transport) {
        transport = this.transportFactory(this.preferredMode, this.wsUrl);
        this.bindTransport(transport);
      }

      this.updateConnectionState({
        ...this.connectionState,
        transport: transport.mode
      });
      await transport.connect();
      this.updateConnectionState({
        ...this.connectionState,
        status: "connected",
        transport: transport.mode,
        error: undefined
      });
      this.bootstrapAuthenticatedSession();
    } catch {
      if (this.preferredMode === "ws") {
        const fallbackTransport = this.transportFactory("mock", this.wsUrl);
        this.bindTransport(fallbackTransport);
        this.updateConnectionState({
          ...this.connectionState,
          transport: fallbackTransport.mode
        });
        try {
          await fallbackTransport.connect();
          this.updateConnectionState({
            ...this.connectionState,
            status: "connected",
            transport: fallbackTransport.mode,
            error: "WebSocket unavailable. Falling back to mock transport."
          });
          this.bootstrapAuthenticatedSession();
          return;
        } catch {
          this.updateConnectionState({
            ...this.connectionState,
            transport: fallbackTransport.mode
          });
        }
      }

      this.updateConnectionState({
        ...this.connectionState,
        status: "disconnected",
        error: "Failed to connect transport"
      });
    }
  }

  disconnect(): void {
    this.transport?.disconnect();
    this.lastSeenStateVersion = null;
    this.updateConnectionState({
      ...this.connectionState,
      status: "disconnected",
      error: undefined
    });
  }

  endSession(): void {
    this.authToken = null;
    this.disconnect();
    this.emit({
      type: "authenticated",
      authenticated: false,
      role: null
    });
  }

  sendIntent(intent: ClientIntent): void {
    if (!this.transport) {
      this.emit({
        type: "error",
        requestId: intent.intentId,
        message: "Cannot send intent while disconnected"
      });
      return;
    }
    this.transport.sendIntent(intent);
  }

  authenticate(role: Role, token?: string): string | null {
    const requestId = makeId("auth");
    const resolvedToken = this.resolveAuthToken(role, token);
    this.authToken = resolvedToken;
    if (!this.transport) {
      this.emit({
        type: "error",
        requestId,
        message: "Cannot authenticate while disconnected"
      });
      return requestId;
    }

    this.transport.sendProtocolRequest({
      type: "authenticate",
      token: resolvedToken,
      request_id: requestId
    });
    return requestId;
  }

  requestResync(): string | null {
    if (!this.transport) {
      this.emit({
        type: "error",
        message: "Cannot request resync while disconnected"
      });
      return null;
    }

    const requestId = makeId("resync");
    const request: ProtocolApplicationRequest = {
      type: "resync_state",
      request_id: requestId,
      last_seen_version: this.lastSeenStateVersion
    };
    this.transport.sendProtocolRequest(request);
    return requestId;
  }

  private bindTransport(transport: GameTransport): void {
    this.transportUnsubscribe?.();
    this.transport = transport;
    this.transportUnsubscribe = transport.onEvent((event) => {
      if (event.type === "authenticated" && !event.authenticated) {
        this.authToken = null;
      }

      if (event.type === "snapshot" && typeof event.stateVersion === "number") {
        if (
          event.incremental &&
          this.lastSeenStateVersion !== null &&
          event.stateVersion !== this.lastSeenStateVersion + 1
        ) {
          this.requestResync();
          return;
        }
        this.lastSeenStateVersion = event.stateVersion;
      }
      this.emit(event);
    });
  }

  private bootstrapAuthenticatedSession(): void {
    if (!this.transport || this.transport.mode !== "ws" || !this.authToken) {
      return;
    }

    this.transport.sendProtocolRequest({
      type: "authenticate",
      token: this.authToken,
      request_id: makeId("auth")
    });
  }

  private resolveAuthToken(role: Role, providedToken?: string): string {
    if (role === "gm") {
      return providedToken?.trim() || import.meta.env.VITE_DM_AUTH_TOKEN || DEFAULT_DM_AUTH_TOKEN;
    }
    return providedToken?.trim() || import.meta.env.VITE_PLAYER_AUTH_TOKEN || DEFAULT_PLAYER_AUTH_TOKEN;
  }

  private updateConnectionState(nextState: ClientConnectionState): void {
    this.connectionState = nextState;
    this.connectionListeners.forEach((listener) => listener(this.connectionState));
  }

  private emit(event: ServerEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }
}
