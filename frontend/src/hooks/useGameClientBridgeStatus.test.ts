import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => {
  let cursor = 0;
  let refs: Array<{ current: unknown }> = [];

  return {
    actions: [] as Array<Record<string, unknown>>,
    eventListener: null as ((event: Record<string, unknown>) => void) | null,
    sentRequests: [] as Array<Record<string, unknown>>,
    beginRender(): void {
      cursor = 0;
    },
    dispatch(action: Record<string, unknown>): void {
      runtime.actions.push(action);
    },
    reset(): void {
      cursor = 0;
      refs = [];
      runtime.actions = [];
      runtime.eventListener = null;
      runtime.sentRequests = [];
    },
    useRef(initialValue: unknown): { current: unknown } {
      const index = cursor;
      cursor += 1;
      refs[index] ??= { current: initialValue };
      return refs[index];
    }
  };
});

vi.mock("react", () => ({
  useEffect: (effect: () => void | (() => void)) => {
    effect();
  },
  useRef: runtime.useRef
}));

vi.mock("@/app/state/useAppStore", () => ({
  useAppDispatch: () => runtime.dispatch
}));

vi.mock("@/infrastructure/ws/GameClient", () => ({
  ManagedGameClient: class {
    authenticate(): void {}
    authenticateWithCode(): void {}
    async connect(): Promise<void> {}
    disconnect(): void {}
    endSession(): void {}
    onConnectionState(): () => void {
      return () => undefined;
    }
    onEvent(listener: (event: Record<string, unknown>) => void): () => void {
      runtime.eventListener = listener;
      return () => undefined;
    }
    sendProtocolRequest(request: Record<string, unknown>): void {
      runtime.sentRequests.push(request);
    }
  }
}));

import { useGameClient } from "@/hooks/useGameClient";

describe("useGameClient Roll20 status", () => {
  beforeEach(() => {
    runtime.reset();
  });

  it("treats a disconnected status response as valid state instead of an error", () => {
    runtime.beginRender();
    const client = useGameClient();

    client.sendProtocolRequest({ type: "get_roll20_bridge_status" }, "Roll20 bridge status");
    const requestId = runtime.sentRequests[0]?.request_id;
    expect(typeof requestId).toBe("string");

    runtime.eventListener?.({
      type: "roll20_bridge_status",
      connected: false,
      requestId
    });

    expect(runtime.actions).toContainEqual({
      type: "set_roll20_bridge_status",
      status: "disconnected",
      checkedAt: expect.any(String)
    });
    expect(runtime.actions).toContainEqual({ type: "clear_intent", intentId: requestId });
    expect(
      runtime.actions.some(
        (action) => action.type === "push_intent_feedback" && action.item !== undefined
      )
    ).toBe(false);
  });
});
