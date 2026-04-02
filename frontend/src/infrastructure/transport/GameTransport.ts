import type { ClientIntent, ServerEvent } from "@/domain/ipc";
import type { ProtocolApplicationRequest } from "@/infrastructure/ws/protocol";

export type TransportUnsubscribe = () => void;

export interface GameTransport {
  connect(): Promise<void>;
  disconnect(): void;
  sendIntent(intent: ClientIntent): void;
  sendProtocolRequest(request: ProtocolApplicationRequest): void;
  onEvent(handler: (event: ServerEvent) => void): TransportUnsubscribe;
  mode: "mock" | "ws";
}
