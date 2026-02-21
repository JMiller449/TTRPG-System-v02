import type { ClientIntent, ServerEvent } from "@/domain/ipc";

export type TransportUnsubscribe = () => void;

export interface GameTransport {
  connect(): Promise<void>;
  disconnect(): void;
  sendIntent(intent: ClientIntent): void;
  onEvent(handler: (event: ServerEvent) => void): TransportUnsubscribe;
  mode: "mock" | "ws";
}
