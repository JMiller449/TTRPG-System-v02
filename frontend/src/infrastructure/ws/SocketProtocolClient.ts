import type { ServerEvent } from "@/domain/ipc";
import {
  adaptProtocolServerEvent,
  initialSocketProtocolState,
  type SocketProtocolState
} from "@/infrastructure/ws/eventAdapters";
import { parseProtocolServerEvent, type ProtocolApplicationRequest } from "@/infrastructure/ws/protocol";

export type SocketProtocolClientUnsubscribe = () => void;

type EventListener = (event: ServerEvent) => void;

export class SocketProtocolClient {
  private socket: WebSocket | null = null;
  private readonly listeners = new Set<EventListener>();
  private protocolState: SocketProtocolState = initialSocketProtocolState;
  private intentionalClose = false;

  constructor(private readonly url: string) {}

  async connect(): Promise<void> {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(this.url);
      this.socket = socket;
      this.intentionalClose = false;
      let opened = false;

      socket.addEventListener(
        "open",
        () => {
          opened = true;
          resolve();
        },
        { once: true }
      );
      socket.addEventListener(
        "error",
        () => {
          if (!opened) {
            reject(new Error("Failed to open websocket connection"));
          }
        },
        { once: true }
      );

      socket.addEventListener("message", (messageEvent) => {
        this.handleMessage(messageEvent.data);
      });

      socket.addEventListener("close", () => {
        const wasIntentional = this.intentionalClose;
        if (this.socket === socket) {
          this.socket = null;
        }
        this.protocolState = initialSocketProtocolState;
        this.intentionalClose = false;

        if (!opened && !wasIntentional) {
          reject(new Error("Websocket connection closed before opening"));
          return;
        }

        if (!wasIntentional) {
          this.emit({ type: "connection_lost", message: "Connection closed" });
        }
      });
    });
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.socket?.close();
    this.socket = null;
    this.protocolState = initialSocketProtocolState;
  }

  sendProtocolRequest(request: ProtocolApplicationRequest): void {
    this.sendPayload(
      request,
      request.request_id ?? undefined,
      "Cannot send request while disconnected"
    );
  }

  onEvent(handler: EventListener): SocketProtocolClientUnsubscribe {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  private handleMessage(messageData: unknown): void {
    try {
      const payload = JSON.parse(String(messageData)) as unknown;
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
  }

  private sendPayload(
    payload: ProtocolApplicationRequest,
    requestId: string | undefined,
    disconnectedMessage: string
  ): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.emit({
        type: "error",
        requestId,
        message: disconnectedMessage
      });
      return;
    }

    this.socket.send(JSON.stringify(payload));
  }

  private emit(event: ServerEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }
}
