import type { ServerEvent } from "@/domain/ipc";
import type { GameTransport, TransportUnsubscribe } from "@/infrastructure/transport/GameTransport";
import type { ProtocolApplicationRequest } from "@/infrastructure/ws/protocol";
import {
  SocketProtocolClient,
  type SocketProtocolClientUnsubscribe
} from "@/infrastructure/ws/SocketProtocolClient";

export class WebSocketGameTransport implements GameTransport {
  public readonly mode = "ws" as const;

  private readonly client: SocketProtocolClient;

  constructor(url: string) {
    this.client = new SocketProtocolClient(url);
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  disconnect(): void {
    this.client.disconnect();
  }

  sendProtocolRequest(request: ProtocolApplicationRequest): void {
    this.client.sendProtocolRequest(request);
  }

  onEvent(handler: (event: ServerEvent) => void): TransportUnsubscribe {
    const unsubscribe: SocketProtocolClientUnsubscribe = this.client.onEvent(handler);
    return unsubscribe;
  }
}
