import { useEffect, useMemo, useRef } from "react";
import { useAppStore } from "@/app/state/store";
import type { ClientIntent } from "@/domain/ipc";
import type { RollRequest } from "@/domain/models";
import { MockGameTransport } from "@/infrastructure/transport/MockGameTransport";
import { WebSocketGameTransport } from "@/infrastructure/transport/WebSocketGameTransport";
import { makeId } from "@/shared/utils/id";

export interface GameClient {
  connect: () => Promise<void>;
  disconnect: () => void;
  sendIntent: (intent: ClientIntent) => void;
  submitRoll: (request: RollRequest) => void;
}

function getIntentLabel(intent: ClientIntent): string {
  switch (intent.type) {
    case "authenticate_gm":
      return "GM authentication";
    case "create_template":
      return `Template create: ${intent.payload.template.name}`;
    case "update_template":
      return "Template update";
    case "instantiate_template":
      return "Template spawn";
    case "save_encounter":
      return `Encounter save: ${intent.payload.encounter.name}`;
    case "spawn_encounter":
      return "Encounter spawn";
    case "submit_roll":
      return `Roll: ${intent.payload.request.stat}`;
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
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const intentLabelMapRef = useRef<Record<string, string>>({});

  const transport = useMemo(() => {
    if ((import.meta.env.VITE_TRANSPORT ?? "mock") === "ws") {
      return new WebSocketGameTransport(import.meta.env.VITE_WS_URL ?? "ws://127.0.0.1:6767/ws");
    }
    return new MockGameTransport();
  }, []);

  useEffect(() => {
    unsubscribeRef.current = transport.onEvent((event) => {
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
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, [dispatch, transport]);

  const connect = async (): Promise<void> => {
    dispatch({ type: "connection_status", status: "connecting" });
    dispatch({ type: "connection_error", error: undefined });
    try {
      await transport.connect();
      dispatch({ type: "connection_status", status: "connected" });
    } catch {
      dispatch({ type: "connection_status", status: "disconnected" });
      dispatch({ type: "connection_error", error: "Failed to connect transport" });
    }
  };

  const disconnect = (): void => {
    transport.disconnect();
    dispatch({ type: "connection_status", status: "disconnected" });
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
    transport.sendIntent(intent);
  };

  const submitRoll = (request: RollRequest): void => {
    const rollIntentId = makeId("intent");
    sendIntent({
      intentId: rollIntentId,
      type: "submit_roll",
      payload: {
        request,
        requestedByRole: state.role ?? "player"
      }
    });
  };

  return {
    connect,
    disconnect,
    sendIntent,
    submitRoll
  };
}
