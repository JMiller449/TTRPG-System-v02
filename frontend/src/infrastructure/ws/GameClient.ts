import type { ServerEvent } from "@/domain/ipc";
import type { Role } from "@/domain/models";
import { resolveDefaultAuthToken } from "@/infrastructure/config/authConfig";
import type { GameTransport, TransportUnsubscribe } from "@/infrastructure/transport/GameTransport";
import { MockGameTransport } from "@/infrastructure/transport/MockGameTransport";
import { WebSocketGameTransport } from "@/infrastructure/transport/WebSocketGameTransport";
import {
  buildAuthenticateRequest,
  buildResyncStateRequest
} from "@/infrastructure/ws/requestBuilders";
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
  reconnectDelaysMs?: number[];
  reconnectScheduler?: (callback: () => void, delayMs: number) => TransportUnsubscribe;
}

type ConnectionListener = (state: ClientConnectionState) => void;
type EventListener = (event: ServerEvent) => void;

const DEFAULT_WS_URL = "ws://127.0.0.1:6767/ws";
const DEFAULT_RECONNECT_DELAYS_MS = [500, 1000, 2000, 5000];

function scheduleReconnect(callback: () => void, delayMs: number): TransportUnsubscribe {
  const timeoutId = globalThis.setTimeout(callback, delayMs);
  return () => {
    globalThis.clearTimeout(timeoutId);
  };
}

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
  private readonly reconnectDelaysMs: number[];
  private readonly reconnectScheduler: (callback: () => void, delayMs: number) => TransportUnsubscribe;

  private transport: GameTransport | null = null;
  private transportUnsubscribe: TransportUnsubscribe | null = null;
  private cancelScheduledReconnect: TransportUnsubscribe | null = null;
  private authToken: string | null = null;
  private lastSeenStateVersion: number | null = null;
  private connectionState: ClientConnectionState;
  private desiredConnected = false;
  private reconnectAttempt = 0;
  private connectInFlight: Promise<void> | null = null;

  constructor(options: ManagedGameClientOptions = {}) {
    this.preferredMode = options.preferredMode ?? "ws";
    this.wsUrl = options.wsUrl ?? DEFAULT_WS_URL;
    this.transportFactory = options.transportFactory ?? createTransport;
    this.reconnectDelaysMs = options.reconnectDelaysMs?.length
      ? options.reconnectDelaysMs
      : DEFAULT_RECONNECT_DELAYS_MS;
    this.reconnectScheduler = options.reconnectScheduler ?? scheduleReconnect;
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
    this.desiredConnected = true;
    this.clearScheduledReconnect();
    await this.connectTransport({ retryOnFailure: false });
  }

  private async connectTransport({ retryOnFailure }: { retryOnFailure: boolean }): Promise<void> {
    if (this.connectInFlight) {
      return this.connectInFlight;
    }

    this.updateConnectionState({
      ...this.connectionState,
      status: "connecting",
      error: undefined
    });

    this.connectInFlight = (async () => {
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
      this.reconnectAttempt = 0;
      this.bootstrapAuthenticatedSession();
    })();

    try {
      await this.connectInFlight;
    } catch {
      this.clearTransport();
      if (retryOnFailure && this.shouldAutoReconnect()) {
        this.queueReconnect("Failed to reconnect transport");
      } else {
        this.updateConnectionState({
          ...this.connectionState,
          transport: this.preferredMode,
          status: "disconnected",
          error: "Failed to connect transport"
        });
      }
    } finally {
      this.connectInFlight = null;
    }
  }

  disconnect(): void {
    this.desiredConnected = false;
    this.clearScheduledReconnect();
    const transport = this.transport;
    this.clearTransport();
    transport?.disconnect();
    this.lastSeenStateVersion = null;
    this.reconnectAttempt = 0;
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

  sendProtocolRequest(request: ProtocolApplicationRequest): void {
    if (!this.transport) {
      this.emit({
        type: "error",
        requestId: request.request_id ?? undefined,
        message: "Cannot send request while disconnected"
      });
      return;
    }
    this.transport.sendProtocolRequest(request);
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

    this.transport.sendProtocolRequest(buildAuthenticateRequest({ token: resolvedToken, requestId }));
    return requestId;
  }

  authenticateWithCode(token: string): string | null {
    const requestId = makeId("auth");
    const resolvedToken = token.trim();
    this.authToken = resolvedToken;
    if (!this.transport) {
      this.emit({
        type: "error",
        requestId,
        message: "Cannot authenticate while disconnected"
      });
      return requestId;
    }

    this.transport.sendProtocolRequest(buildAuthenticateRequest({ token: resolvedToken, requestId }));
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
    const request = buildResyncStateRequest({
      requestId,
      lastSeenVersion: this.lastSeenStateVersion
    });
    this.transport.sendProtocolRequest(request);
    return requestId;
  }

  private bindTransport(transport: GameTransport): void {
    this.transportUnsubscribe?.();
    this.transport = transport;
    this.transportUnsubscribe = transport.onEvent((event) => {
      if (event.type === "connection_lost") {
        this.handleConnectionLost(event.message);
        return;
      }

      if (event.type === "authenticated" && !event.authenticated) {
        this.authToken = null;
      }

      if (event.type === "snapshot" && typeof event.stateVersion === "number") {
        if (
          event.incremental &&
          this.lastSeenStateVersion !== null &&
          event.stateVersion !== this.lastSeenStateVersion + 1
        ) {
          const requestId = this.requestResync();
          if (requestId) {
            this.emit({
              type: "sync_recovery",
              requestId,
              lastSeenVersion: this.lastSeenStateVersion,
              receivedVersion: event.stateVersion
            });
          }
          return;
        }
        this.lastSeenStateVersion = event.stateVersion;
      }
      this.emit(event);
    });
  }

  private clearTransport(): void {
    this.transportUnsubscribe?.();
    this.transportUnsubscribe = null;
    this.transport = null;
  }

  private handleConnectionLost(message: string): void {
    this.lastSeenStateVersion = null;
    this.clearTransport();

    if (!this.shouldAutoReconnect()) {
      this.updateConnectionState({
        ...this.connectionState,
        status: "disconnected",
        error: message
      });
      return;
    }

    this.queueReconnect(message);
  }

  private shouldAutoReconnect(): boolean {
    return this.desiredConnected && this.preferredMode === "ws";
  }

  private queueReconnect(reason: string): void {
    if (this.cancelScheduledReconnect) {
      return;
    }

    const delayMs = this.reconnectDelaysMs[Math.min(this.reconnectAttempt, this.reconnectDelaysMs.length - 1)] ?? 0;
    this.reconnectAttempt += 1;
    this.updateConnectionState({
      ...this.connectionState,
      transport: "ws",
      status: "connecting",
      error: `${reason}. Reconnecting in ${delayMs}ms...`
    });
    this.cancelScheduledReconnect = this.reconnectScheduler(() => {
      this.cancelScheduledReconnect = null;
      void this.connectTransport({ retryOnFailure: true });
    }, delayMs);
  }

  private clearScheduledReconnect(): void {
    this.cancelScheduledReconnect?.();
    this.cancelScheduledReconnect = null;
  }

  private bootstrapAuthenticatedSession(): void {
    if (!this.transport || this.transport.mode !== "ws" || !this.authToken) {
      return;
    }

    this.transport.sendProtocolRequest(
      buildAuthenticateRequest({
        token: this.authToken,
        requestId: makeId("auth")
      })
    );
  }

  private resolveAuthToken(role: Role, providedToken?: string): string {
    return providedToken?.trim() || resolveDefaultAuthToken(role);
  }

  private updateConnectionState(nextState: ClientConnectionState): void {
    this.connectionState = nextState;
    this.connectionListeners.forEach((listener) => listener(this.connectionState));
  }

  private emit(event: ServerEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }
}
