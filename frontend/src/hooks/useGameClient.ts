import { useEffect, useRef } from "react";
import { useAppDispatch } from "@/app/state/useAppStore";
import type { Role } from "@/domain/models";
import { ManagedGameClient, type ManagedGameClientOptions } from "@/infrastructure/ws/GameClient";
import type { ProtocolApplicationRequest } from "@/infrastructure/ws/protocol";
import { makeId } from "@/shared/utils/id";

export interface GameClient {
  connect: () => Promise<void>;
  disconnect: () => void;
  endSession: () => void;
  sendProtocolRequest: (request: ProtocolApplicationRequest, label: string) => void;
  authenticate: (role: Role, token?: string) => void;
  authenticateWithCode: (code: string) => void;
}

interface PendingIntentMetadata {
  label: string;
  requestType: ProtocolApplicationRequest["type"];
  resolvesOnSnapshot: boolean;
  quiet: boolean;
}

const QUIET_REQUEST_TYPES = new Set<ProtocolApplicationRequest["type"]>([
  "get_action_formula_authoring_metadata",
  "get_augmentation_target_metadata",
  "get_roll20_bridge_status",
  "get_sheet_access_codes",
  "get_variable_registry",
  "get_xp_tracker"
]);

export function requestUsesQuietFeedback(request: ProtocolApplicationRequest): boolean {
  return QUIET_REQUEST_TYPES.has(request.type);
}

export function requestResolvesOnSnapshot(request: ProtocolApplicationRequest): boolean {
  if (request.type === "perform_action") {
    return false;
  }
  if (request.type === "create_instanced_sheet" && request.generate_access_code) {
    return false;
  }
  return true;
}

function isRoll20BridgeUnavailableError(message: string): boolean {
  return message.toLowerCase().includes("roll20 chat bridge is not connected");
}

const ROLL20_BRIDGE_SETUP_HINT =
  "Open Roll20 with the extension loaded, then confirm its options use the backend's Roll20 bridge WebSocket URL and matching SERVICE_AUTH_CODE.";

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
    return `${label} failed: Roll20 bridge disconnected. ${ROLL20_BRIDGE_SETUP_HINT}`;
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
  const dispatch = useAppDispatch();
  const clientRef = useRef<ManagedGameClient | null>(null);
  const pendingIntentMapRef = useRef<Record<string, PendingIntentMetadata>>({});
  const facadeRef = useRef<GameClient | null>(null);
  if (!clientRef.current) {
    const options: ManagedGameClientOptions = {
      wsUrl: import.meta.env.VITE_WS_URL
    };
    clientRef.current = new ManagedGameClient(options);
  }
  const client = clientRef.current;

  useEffect(() => {
    const resolveIntent = (requestId: string): PendingIntentMetadata | null => {
      const metadata = pendingIntentMapRef.current[requestId];
      if (!metadata) {
        return null;
      }
      delete pendingIntentMapRef.current[requestId];
      if (!metadata.quiet) {
        dispatch({
          type: "push_intent_feedback",
          item: {
            id: makeId("feedback"),
            intentId: requestId,
            status: "success",
            message: buildIntentSuccessMessage(metadata.label),
            createdAt: new Date().toISOString()
          }
        });
      }
      dispatch({ type: "clear_intent", intentId: requestId });
      return metadata;
    };

    const unsubscribeConnection = client.onConnectionState((connection) => {
      dispatch({ type: "connection_status", status: connection.status });
      dispatch({ type: "connection_error", error: connection.error });
    });

    const unsubscribeEvents = client.onEvent((event) => {
      if (event.type === "authenticated") {
        if (!event.authenticated) {
          dispatch({ type: "reset_session_ui" });
        }
        dispatch({ type: "set_role", role: event.authenticated ? event.role : null });
        dispatch({
          type: "set_gm_authenticated",
          value: event.authenticated && event.role === "gm"
        });
        dispatch({ type: "connection_error", error: event.reason ? event.reason : undefined });
        if (!event.authenticated && event.reason) {
          return;
        }
        return;
      }
      if (event.type === "snapshot") {
        dispatch({ type: "apply_snapshot", snapshot: event.snapshot });
        if (event.requestId) {
          const metadata = pendingIntentMapRef.current[event.requestId];
          if (metadata?.resolvesOnSnapshot) {
            resolveIntent(event.requestId);
          }
        }
        return;
      }
      if (event.type === "ack") {
        const metadata = resolveIntent(event.requestId);
        if (metadata?.requestType === "perform_action") {
          dispatch({
            type: "set_roll20_bridge_status",
            status: "connected",
            checkedAt: new Date().toISOString()
          });
          dispatch({
            type: "clear_connection_error_matching",
            text: "roll20 chat bridge"
          });
        }
        return;
      }
      if (event.type === "sheet_access_claimed") {
        dispatch({ type: "set_active_sheet_local", sheetId: event.instanceId });
        dispatch({ type: "set_player_sheet_selection_complete", value: true });
        if (event.requestId) {
          resolveIntent(event.requestId);
        }
        return;
      }
      if (event.type === "sheet_access_codes") {
        dispatch({ type: "set_sheet_access_codes", codes: event.codes });
        if (event.requestId) {
          resolveIntent(event.requestId);
        }
        return;
      }
      if (event.type === "state_backup_exported") {
        dispatch({ type: "set_state_backup_export", backup: event.backup });
        if (event.requestId) {
          resolveIntent(event.requestId);
        }
        return;
      }
      if (event.type === "action_formula_authoring_metadata") {
        dispatch({ type: "set_action_formula_authoring_metadata", metadata: event.metadata });
        if (event.requestId) {
          resolveIntent(event.requestId);
        }
        return;
      }
      if (event.type === "augmentation_target_metadata") {
        dispatch({ type: "set_augmentation_target_metadata", metadata: event.metadata });
        if (event.requestId) {
          resolveIntent(event.requestId);
        }
        return;
      }
      if (event.type === "xp_tracker") {
        dispatch({ type: "set_xp_tracker", tracker: event.tracker });
        if (event.requestId) {
          resolveIntent(event.requestId);
        }
        return;
      }
      if (event.type === "roll20_bridge_status") {
        dispatch({
          type: "set_roll20_bridge_status",
          status: event.connected ? "connected" : "disconnected",
          checkedAt: new Date().toISOString(),
          error: event.connected
            ? undefined
            : `Roll20 chat bridge is not connected. ${ROLL20_BRIDGE_SETUP_HINT}`
        });
        if (event.connected) {
          dispatch({
            type: "clear_connection_error_matching",
            text: "roll20 chat bridge"
          });
        }
        if (event.requestId) {
          if (event.connected) {
            resolveIntent(event.requestId);
          } else {
            const metadata = pendingIntentMapRef.current[event.requestId];
            delete pendingIntentMapRef.current[event.requestId];
            dispatch({
              type: "push_intent_feedback",
              item: {
                id: makeId("feedback"),
                intentId: event.requestId,
                status: "error",
                message: `${metadata?.label ?? "Roll20 bridge status"} failed: Roll20 bridge disconnected. ${ROLL20_BRIDGE_SETUP_HINT}`,
                createdAt: new Date().toISOString()
              }
            });
            dispatch({ type: "clear_intent", intentId: event.requestId });
          }
        }
        return;
      }
      if (event.type === "sync_recovery") {
        pendingIntentMapRef.current[event.requestId] = {
          label: "State resync",
          requestType: "resync_state",
          resolvesOnSnapshot: true,
          quiet: false
        };
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
      if (event.type === "connection_lost") {
        dispatch({ type: "connection_error", error: event.message });
        return;
      }
      const metadata = event.requestId ? pendingIntentMapRef.current[event.requestId] : undefined;
      const label = metadata?.label ?? (event.requestId ? "Intent" : "Transport");
      const isRoll20BridgeError = isRoll20BridgeUnavailableError(event.message);
      if (isRoll20BridgeError) {
        dispatch({
          type: "set_roll20_bridge_status",
          status: "disconnected",
          checkedAt: new Date().toISOString(),
          error: `${event.message} ${ROLL20_BRIDGE_SETUP_HINT}`
        });
      }
      if (!event.requestId) {
        dispatch({ type: "connection_error", error: event.message });
      }
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
        delete pendingIntentMapRef.current[event.requestId];
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

  const sendProtocolRequest = (request: ProtocolApplicationRequest, label: string): void => {
    const requestId = request.request_id ?? makeId("request");
    const requestWithId = {
      ...request,
      request_id: requestId
    } as ProtocolApplicationRequest;
    const quiet = requestUsesQuietFeedback(requestWithId);
    pendingIntentMapRef.current[requestId] = {
      label,
      requestType: request.type,
      resolvesOnSnapshot: requestResolvesOnSnapshot(requestWithId),
      quiet
    };
    dispatch({ type: "queue_intent", intentId: requestId });
    if (!quiet) {
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
    }
    client.sendProtocolRequest(requestWithId);
  };

  const authenticate = (role: Role, token?: string): void => {
    client.authenticate(role, token);
  };

  const authenticateWithCode = (code: string): void => {
    client.authenticateWithCode(code);
  };

  if (!facadeRef.current) {
    facadeRef.current = {
      connect,
      disconnect,
      endSession,
      sendProtocolRequest,
      authenticate,
      authenticateWithCode
    };
  }

  facadeRef.current.connect = connect;
  facadeRef.current.disconnect = disconnect;
  facadeRef.current.endSession = endSession;
  facadeRef.current.sendProtocolRequest = sendProtocolRequest;
  facadeRef.current.authenticate = authenticate;
  facadeRef.current.authenticateWithCode = authenticateWithCode;

  return facadeRef.current;
}
