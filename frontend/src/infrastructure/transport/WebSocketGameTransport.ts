import type { ClientIntent, ServerEvent } from "@/domain/ipc";
import type { GameTransport, TransportUnsubscribe } from "@/infrastructure/transport/GameTransport";

export class WebSocketGameTransport implements GameTransport {
  public readonly mode = "ws" as const;

  private socket: WebSocket | null = null;

  private listeners = new Set<(event: ServerEvent) => void>();

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
          const event = JSON.parse(String(messageEvent.data)) as ServerEvent;
          this.emit(event);
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
