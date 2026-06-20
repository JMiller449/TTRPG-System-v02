import { useEffect, useRef } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import type { ClientIntent } from "@/domain/ipc";
import type { Role } from "@/domain/models";
import {
  ManagedGameClient,
  type ManagedGameClientOptions
} from "@/infrastructure/ws/GameClient";
import type { ProtocolApplicationRequest } from "@/infrastructure/ws/protocol";
import { makeId } from "@/shared/utils/id";

export interface GameClient {
  connect: () => Promise<void>;
  disconnect: () => void;
  endSession: () => void;
  sendIntent: (intent: ClientIntent) => void;
  sendProtocolRequest: (request: ProtocolApplicationRequest, label: string) => void;
  authenticate: (role: Role, token?: string) => void;
  authenticateWithCode: (code: string) => void;
}

function getPreferredTransportMode(): "mock" | "ws" {
  return import.meta.env.VITE_TRANSPORT === "mock" ? "mock" : "ws";
}

function getIntentLabel(intent: ClientIntent): string {
  switch (intent.type) {
    case "authenticate_gm":
      return "GM authentication";
    case "set_active_sheet":
      return "Active sheet change";
    default: {
      const _exhaustive: never = intent;
      void _exhaustive;
      return "Intent";
    }
  }
}

function isRoll20BridgeUnavailableError(message: string): boolean {
  return message.toLowerCase().includes("roll20 chat bridge is not connected");
}

export function buildIntentSuccessMessage(label: string): string {
  return label === "State resync" ? "State resynced." : `${label} synced.`;
}

export function buildIntentErrorMessage({
  label,
  message,
  requestId,
  isRoll20BridgeError
}: {
  label: string;
  message: string;
  requestId?: string;
  isRoll20BridgeError: boolean;
}): string {
  if (isRoll20BridgeError) {
    return `${label} failed: Roll20 bridge disconnected. Open Roll20 with the extension loaded before trying again.`;
  }
  if (!requestId) {
    return `Transport error: ${message}`;
  }
  if (message.toLowerCase().includes("disconnected")) {
    return `${label} failed: ${message}`;
  }
  return `${label} rejected: ${message}`;
}

export function useGameClient(): GameClient {
  const { dispatch } = useAppStore();
  const clientRef = useRef<ManagedGameClient | null>(null);
  const intentLabelMapRef = useRef<Record<string, string>>({});
  if (!clientRef.current) {
    const options: ManagedGameClientOptions = {
      preferredMode: getPreferredTransportMode(),
      wsUrl: import.meta.env.VITE_WS_URL
    };
    clientRef.current = new ManagedGameClient(options);
  }
  const client = clientRef.current;

  useEffect(() => {
    const unsubscribeConnection = client.onConnectionState((connection) => {
      dispatch({ type: "connection_transport", transport: connection.transport });
      dispatch({ type: "connection_status", status: connection.status });
      dispatch({ type: "connection_error", error: connection.error });
    });

    const unsubscribeEvents = client.onEvent((event) => {
      if (event.type === "authenticated") {
        if (!event.authenticated) {
          dispatch({ type: "reset_session_ui" });
        }
        dispatch({ type: "set_role", role: event.authenticated ? event.role : null });
        dispatch({ type: "set_gm_authenticated", value: event.authenticated && event.role === "gm" });
        dispatch({ type: "connection_error", error: event.reason ? event.reason : undefined });
        if (!event.authenticated && event.reason) {
          return;
        }
        return;
      }
      if (event.type === "snapshot") {
        dispatch({ type: "apply_snapshot", snapshot: event.snapshot });
        if (event.requestId) {
          const label = intentLabelMapRef.current[event.requestId] ?? "Intent";
          delete intentLabelMapRef.current[event.requestId];
          dispatch({
            type: "push_intent_feedback",
            item: {
              id: makeId("feedback"),
              intentId: event.requestId,
              status: "success",
              message: buildIntentSuccessMessage(label),
              createdAt: new Date().toISOString()
            }
          });
          dispatch({ type: "clear_intent", intentId: event.requestId });
        }
        return;
      }
      if (event.type === "ack") {
        const label = intentLabelMapRef.current[event.requestId] ?? "Intent";
        delete intentLabelMapRef.current[event.requestId];
        dispatch({
          type: "push_intent_feedback",
          item: {
            id: makeId("feedback"),
            intentId: event.requestId,
            status: "success",
            message: buildIntentSuccessMessage(label),
            createdAt: new Date().toISOString()
          }
        });
        dispatch({ type: "clear_intent", intentId: event.requestId });
        return;
      }
      if (event.type === "sheet_access_claimed") {
        dispatch({ type: "set_active_sheet_local", sheetId: event.instanceId });
        dispatch({ type: "set_player_sheet_selection_complete", value: true });
        if (event.requestId) {
          const label = intentLabelMapRef.current[event.requestId] ?? "Sheet access";
          delete intentLabelMapRef.current[event.requestId];
          dispatch({
            type: "push_intent_feedback",
            item: {
              id: makeId("feedback"),
              intentId: event.requestId,
              status: "success",
              message: buildIntentSuccessMessage(label),
              createdAt: new Date().toISOString()
            }
          });
          dispatch({ type: "clear_intent", intentId: event.requestId });
        }
        return;
      }
      if (event.type === "action_formula_authoring_metadata") {
        dispatch({ type: "set_action_formula_authoring_metadata", metadata: event.metadata });
        if (event.requestId) {
          const label = intentLabelMapRef.current[event.requestId] ?? "Authoring metadata";
          delete intentLabelMapRef.current[event.requestId];
          dispatch({
            type: "push_intent_feedback",
            item: {
              id: makeId("feedback"),
              intentId: event.requestId,
              status: "success",
              message: buildIntentSuccessMessage(label),
              createdAt: new Date().toISOString()
            }
          });
          dispatch({ type: "clear_intent", intentId: event.requestId });
        }
        return;
      }
      if (event.type === "augmentation_target_metadata") {
        dispatch({ type: "set_augmentation_target_metadata", metadata: event.metadata });
        if (event.requestId) {
          const label = intentLabelMapRef.current[event.requestId] ?? "Augmentation targets";
          delete intentLabelMapRef.current[event.requestId];
          dispatch({
            type: "push_intent_feedback",
            item: {
              id: makeId("feedback"),
              intentId: event.requestId,
              status: "success",
              message: buildIntentSuccessMessage(label),
              createdAt: new Date().toISOString()
            }
          });
          dispatch({ type: "clear_intent", intentId: event.requestId });
        }
        return;
      }
      if (event.type === "roll20_bridge_status") {
        dispatch({
          type: "set_roll20_bridge_status",
          status: event.connected ? "connected" : "disconnected",
          checkedAt: new Date().toISOString(),
          error: event.connected ? undefined : "Roll20 chat bridge is not connected."
        });
        if (event.requestId) {
          const label = intentLabelMapRef.current[event.requestId] ?? "Roll20 bridge status";
          delete intentLabelMapRef.current[event.requestId];
          dispatch({
            type: "push_intent_feedback",
            item: {
              id: makeId("feedback"),
              intentId: event.requestId,
              status: event.connected ? "success" : "error",
              message: event.connected
                ? `${label} synced.`
                : "Roll20 bridge disconnected. Open Roll20 with the extension loaded before sending chat output.",
              createdAt: new Date().toISOString()
            }
          });
          dispatch({ type: "clear_intent", intentId: event.requestId });
        }
        return;
      }
      if (event.type === "sync_recovery") {
        intentLabelMapRef.current[event.requestId] = "State resync";
        dispatch({ type: "queue_intent", intentId: event.requestId });
        dispatch({
          type: "push_intent_feedback",
          item: {
            id: makeId("feedback"),
            intentId: event.requestId,
            status: "pending",
            message: `State version gap detected. Resyncing from v${event.lastSeenVersion ?? "unknown"} to v${event.receivedVersion}.`,
            createdAt: new Date().toISOString()
          }
        });
        return;
      }
      const label = event.requestId ? intentLabelMapRef.current[event.requestId] ?? "Intent" : "Transport";
      const isRoll20BridgeError = isRoll20BridgeUnavailableError(event.message);
      if (isRoll20BridgeError) {
        dispatch({
          type: "set_roll20_bridge_status",
          status: "disconnected",
          checkedAt: new Date().toISOString(),
          error: event.message
        });
      }
      dispatch({ type: "connection_error", error: event.message });
      dispatch({
        type: "push_intent_feedback",
        item: {
          id: makeId("feedback"),
          intentId: event.requestId,
          status: "error",
          message: buildIntentErrorMessage({
            label,
            message: event.message,
            requestId: event.requestId,
            isRoll20BridgeError
          }),
          createdAt: new Date().toISOString()
        }
      });
      if (event.requestId) {
        delete intentLabelMapRef.current[event.requestId];
        dispatch({ type: "clear_intent", intentId: event.requestId });
      }
    });

    return () => {
      unsubscribeConnection();
      unsubscribeEvents();
    };
  }, [client, dispatch]);

  const connect = async (): Promise<void> => {
    await client.connect();
  };

  const disconnect = (): void => {
    client.disconnect();
  };

  const endSession = (): void => {
    client.endSession();
  };

  const sendIntent = (intent: ClientIntent): void => {
    const label = getIntentLabel(intent);
    intentLabelMapRef.current[intent.intentId] = label;
    dispatch({ type: "queue_intent", intentId: intent.intentId });
    dispatch({
      type: "push_intent_feedback",
      item: {
        id: makeId("feedback"),
        intentId: intent.intentId,
        status: "pending",
        message: `${label} pending...`,
        createdAt: new Date().toISOString()
      }
    });
    client.sendIntent(intent);
  };

  const sendProtocolRequest = (request: ProtocolApplicationRequest, label: string): void => {
    const requestId = request.request_id ?? makeId("request");
    const requestWithId = {
      ...request,
      request_id: requestId
    } as ProtocolApplicationRequest;
    intentLabelMapRef.current[requestId] = label;
    dispatch({ type: "queue_intent", intentId: requestId });
    dispatch({
      type: "push_intent_feedback",
      item: {
        id: makeId("feedback"),
        intentId: requestId,
        status: "pending",
        message: `${label} pending...`,
        createdAt: new Date().toISOString()
      }
    });
    client.sendProtocolRequest(requestWithId);
  };

  const authenticate = (role: Role, token?: string): void => {
    client.authenticate(role, token);
  };

  const authenticateWithCode = (code: string): void => {
    client.authenticateWithCode(code);
  };

  return {
    connect,
    disconnect,
    endSession,
    sendIntent,
    sendProtocolRequest,
    authenticate,
    authenticateWithCode
  };
}
