import { beforeEach, describe, expect, it, vi } from "vitest";

const hookRuntime = vi.hoisted(() => {
  let cursor = 0;
  let refs: Array<{ current: unknown }> = [];

  return {
    beginRender(): void {
      cursor = 0;
    },
    reset(): void {
      cursor = 0;
      refs = [];
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
  useEffect: () => undefined,
  useRef: hookRuntime.useRef
}));

vi.mock("@/app/state/useAppStore", () => ({
  useAppDispatch: () => () => undefined,
  useAppStore: () => ({ dispatch: () => undefined })
}));

import { useGameClient } from "@/hooks/useGameClient";

describe("useGameClient identity", () => {
  beforeEach(() => {
    hookRuntime.reset();
  });

  it("keeps one facade across store-driven rerenders", () => {
    hookRuntime.beginRender();
    const first = useGameClient();
    const firstSendProtocolRequest = first.sendProtocolRequest;

    hookRuntime.beginRender();
    const second = useGameClient();

    expect(second).toBe(first);
    expect(second.sendProtocolRequest).not.toBe(firstSendProtocolRequest);
  });
});
