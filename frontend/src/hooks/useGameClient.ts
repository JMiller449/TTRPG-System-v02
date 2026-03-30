import { useCallback, useEffect, useRef } from "react";
import { useAppStore } from "@/app/state/store";
import type { ClientIntent } from "@/domain/ipc";
import type { RollRequest } from "@/domain/models";
import type { GameTransport } from "@/infrastructure/transport/GameTransport";
import { MockGameTransport } from "@/infrastructure/transport/MockGameTransport";
import { WebSocketGameTransport } from "@/infrastructure/transport/WebSocketGameTransport";
import { makeId } from "@/shared/utils/id";

export interface GameClient {
  connect: () => Promise<void>;
  disconnect: () => void;
  sendIntent: (intent: ClientIntent) => void;
  submitRoll: (request: RollRequest) => void;
}

const DEFAULT_WS_URL = "ws://127.0.0.1:6767/ws";

function getPreferredTransportMode(): "mock" | "ws" {
  return import.meta.env.VITE_TRANSPORT === "mock" ? "mock" : "ws";
}

function createTransport(mode: "mock" | "ws"): GameTransport {
  if (mode === "ws") {
    return new WebSocketGameTransport(import.meta.env.VITE_WS_URL ?? DEFAULT_WS_URL);
  }
  return new MockGameTransport();
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
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const intentLabelMapRef = useRef<Record<string, string>>({});
  const transportRef = useRef<GameTransport | null>(null);
  const preferredTransportRef = useRef<"mock" | "ws">(getPreferredTransportMode());

  const bindTransport = useCallback((transport: GameTransport): void => {
    unsubscribeRef.current?.();
    transportRef.current = transport;
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
  }, [dispatch]);

  useEffect(() => {
    const transport = createTransport(preferredTransportRef.current);
    dispatch({ type: "connection_transport", transport: transport.mode });
    bindTransport(transport);

    return () => {
      transportRef.current?.disconnect();
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
      transportRef.current = null;
    };
  }, [bindTransport, dispatch]);

  const connect = async (): Promise<void> => {
    dispatch({ type: "connection_status", status: "connecting" });
    dispatch({ type: "connection_error", error: undefined });
    try {
      let transport = transportRef.current;
      if (preferredTransportRef.current === "ws" && transport?.mode !== "ws") {
        transport = createTransport("ws");
        bindTransport(transport);
      } else if (!transport) {
        transport = createTransport(preferredTransportRef.current);
        bindTransport(transport);
      }
      dispatch({ type: "connection_transport", transport: transport.mode });
      await transport.connect();
      dispatch({ type: "connection_status", status: "connected" });
    } catch {
      if (preferredTransportRef.current === "ws") {
        const fallbackTransport = createTransport("mock");
        bindTransport(fallbackTransport);
        dispatch({ type: "connection_transport", transport: fallbackTransport.mode });
        try {
          await fallbackTransport.connect();
          dispatch({ type: "connection_status", status: "connected" });
          dispatch({
            type: "connection_error",
            error: "WebSocket unavailable. Falling back to mock transport."
          });
          return;
        } catch {
          dispatch({ type: "connection_transport", transport: "mock" });
        }
      }

      dispatch({ type: "connection_status", status: "disconnected" });
      dispatch({ type: "connection_error", error: "Failed to connect transport" });
    }
  };

  const disconnect = (): void => {
    transportRef.current?.disconnect();
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
    transportRef.current?.sendIntent(intent);
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
