import { useEffect, useRef } from "react";
import { useAppStore } from "@/app/state/store";
import type { ClientIntent } from "@/domain/ipc";
import type { Role, RollRequest } from "@/domain/models";
import {
  ManagedGameClient,
  type ManagedGameClientOptions
} from "@/infrastructure/ws/GameClient";
import { makeId } from "@/shared/utils/id";

export interface GameClient {
  connect: () => Promise<void>;
  disconnect: () => void;
  endSession: () => void;
  sendIntent: (intent: ClientIntent) => void;
  authenticate: (role: Role, token?: string) => void;
  submitRoll: (request: RollRequest) => void;
}

function getPreferredTransportMode(): "mock" | "ws" {
  return import.meta.env.VITE_TRANSPORT === "mock" ? "mock" : "ws";
}

function getIntentLabel(intent: ClientIntent): string {
  switch (intent.type) {
    case "authenticate_gm":
      return "GM authentication";
    case "create_sheet":
      return `Sheet create: ${intent.payload.sheet.name}`;
    case "update_sheet":
      return "Sheet update";
    case "instantiate_sheet":
      return "Sheet spawn";
    case "save_encounter":
      return `Encounter save: ${intent.payload.encounter.name}`;
    case "spawn_encounter":
      return "Encounter spawn";
    case "submit_roll":
      return intent.payload.request.kind === "dice"
        ? `Roll: ${intent.payload.request.count}d${intent.payload.request.sides}`
        : `Roll: ${intent.payload.request.stat}`;
    case "set_active_sheet":
      return "Active sheet change";
    default: {
      const _exhaustive: never = intent;
      void _exhaustive;
      return "Intent";
    }
  }
}

export function useGameClient(): GameClient {
  const { state, dispatch } = useAppStore();
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
        return;
      }
      if (event.type === "patch") {
        dispatch({ type: "apply_patch", ops: event.ops });
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
            message: `${label} synced.`,
            createdAt: new Date().toISOString()
          }
        });
        dispatch({ type: "clear_intent", intentId: event.requestId });
        return;
      }
      const label = event.requestId ? intentLabelMapRef.current[event.requestId] ?? "Intent" : "Transport";
      dispatch({ type: "connection_error", error: event.message });
      dispatch({
        type: "push_intent_feedback",
        item: {
          id: makeId("feedback"),
          intentId: event.requestId,
          status: "error",
          message: event.requestId ? `${label} failed: ${event.message}` : `Transport error: ${event.message}`,
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

  const authenticate = (role: Role, token?: string): void => {
    client.authenticate(role, token);
  };

  const submitRoll = (request: RollRequest): void => {
    const rollIntentId = makeId("intent");
    sendIntent({
      intentId: rollIntentId,
      type: "submit_roll",
      payload: {
        request,
        requestedByRole: state.serverState.role ?? "player"
      }
    });
  };

  return {
    connect,
    disconnect,
    endSession,
    sendIntent,
    authenticate,
    submitRoll
  };
}
