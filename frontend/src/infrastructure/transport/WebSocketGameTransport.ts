import type { ClientIntent, ServerEvent } from "@/domain/ipc";
import type { GameTransport, TransportUnsubscribe } from "@/infrastructure/transport/GameTransport";
import type { ProtocolApplicationRequest } from "@/infrastructure/ws/protocol";
import {
  adaptProtocolServerEvent,
  initialSocketProtocolState,
  type SocketProtocolState
} from "@/infrastructure/ws/eventAdapters";
import { parseProtocolServerEvent } from "@/infrastructure/ws/protocol";

export class WebSocketGameTransport implements GameTransport {
  public readonly mode = "ws" as const;

  private socket: WebSocket | null = null;

  private listeners = new Set<(event: ServerEvent) => void>();
  private protocolState: SocketProtocolState = initialSocketProtocolState;

  constructor(private readonly url: string) {}

  async connect(): Promise<void> {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(this.url);
      this.socket = socket;

      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener(
        "error",
        () => {
          reject(new Error("Failed to open websocket connection"));
        },
        { once: true }
      );

      socket.addEventListener("message", (messageEvent) => {
        try {
          const payload = JSON.parse(String(messageEvent.data)) as unknown;
          const protocolEvent = parseProtocolServerEvent(payload);
          if (!protocolEvent) {
            this.emit({ type: "error", message: "Invalid server payload" });
            return;
          }

          const adapted = adaptProtocolServerEvent(this.protocolState, protocolEvent);
          this.protocolState = adapted.nextProtocolState;
          adapted.events.forEach((event) => this.emit(event));
        } catch {
          this.emit({ type: "error", message: "Invalid server payload" });
        }
      });

      socket.addEventListener("close", () => {
        this.emit({ type: "error", message: "Connection closed" });
      });
    });
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
    this.protocolState = initialSocketProtocolState;
  }

  sendIntent(intent: ClientIntent): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.emit({
        type: "error",
        requestId: intent.intentId,
        message: "Cannot send intent while disconnected"
      });
      return;
    }

    this.socket.send(JSON.stringify(intent));
  }

  sendProtocolRequest(request: ProtocolApplicationRequest): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.emit({
        type: "error",
        requestId: request.request_id ?? undefined,
        message: "Cannot send request while disconnected"
      });
      return;
    }

    this.socket.send(JSON.stringify(request));
  }

  onEvent(handler: (event: ServerEvent) => void): TransportUnsubscribe {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  private emit(event: ServerEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }
}
