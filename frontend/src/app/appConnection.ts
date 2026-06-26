import type { ConnectionStatus } from "@/app/state/types";

export function shouldConnectApp(connectionStatus: ConnectionStatus): boolean {
  return connectionStatus === "disconnected";
}
