// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { initialState } from "@/app/state/initialState";
import { StoreContext } from "@/app/state/storeContext";
import { TagAuthoringPage } from "@/features/tags/TagAuthoringPage";
import type { GameClient } from "@/hooks/useGameClient";

describe("TagAuthoringPage validation", () => {
  it("marks required fields up front and explains a failed create attempt", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    const root = createRoot(container);
    const sendProtocolRequest = vi.fn();
    const client = { sendProtocolRequest } as unknown as GameClient;

    await act(async () => {
      root.render(
        <StoreContext.Provider value={{ state: structuredClone(initialState), dispatch: vi.fn() }}>
          <TagAuthoringPage client={client} />
        </StoreContext.Provider>
      );
      await Promise.resolve();
    });

    const nameInput = container.querySelector<HTMLInputElement>(
      'input[placeholder="e.g. Long Sword"]'
    );
    const createButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Create Tag"
    );
    expect(nameInput?.required).toBe(true);
    expect(nameInput?.getAttribute("aria-invalid")).toBe("false");
    expect(createButton?.disabled).toBe(false);
    expect(container.textContent).not.toContain("Complete all required fields.");

    await act(async () => {
      createButton?.click();
      await Promise.resolve();
    });

    expect(nameInput?.getAttribute("aria-invalid")).toBe("true");
    expect(container.textContent).toContain("Complete all required fields.");
    expect(sendProtocolRequest).not.toHaveBeenCalled();

    await act(async () => root.unmount());
  });
});
