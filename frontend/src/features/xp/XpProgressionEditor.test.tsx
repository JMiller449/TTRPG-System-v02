// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { XpProgressionEditor } from "./XpProgressionEditor";
import { SheetXpProgressBar } from "./SheetXpProgressBar";
import type { GameClient } from "@/hooks/useGameClient";

const store = vi.hoisted(() => ({
  state: {
    serverState: { attributes: {} },
    uiState: {
      xpTracker: {
        sheets: [
          {
            instance_id: "hero",
            current_xp: 100,
            xp_required: 400,
            xp_remaining: 300,
            ready_to_level: false,
            goal_error: null as string | null
          }
        ]
      }
    }
  }
}));
vi.mock("@/app/state/useAppStore", () => ({ useAppStore: () => store }));
const defaults = {
  mode: "tuning" as const,
  base_xp: 100,
  growth_exponent: 1.35,
  milestone_interval: 25,
  milestone_multiplier: 1.08,
  growth_increase_per_milestone: 0.02,
  rounding: 10,
  expression: "100 * @level ** 2"
};

async function mount() {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  const sendProtocolRequest = vi.fn();
  const client = { sendProtocolRequest } as unknown as GameClient;
  return { container, root, client, sendProtocolRequest };
}

describe("Derived XP goals", () => {
  it("submits the selected mode and reconciles to server settings", async () => {
    const { container, root, client, sendProtocolRequest } = await mount();
    await act(async () =>
      root.render(<XpProgressionEditor client={client} progression={defaults} />)
    );
    expect(container.textContent).toContain("Base XP");
    expect(container.textContent).not.toContain("Player Thresholds");
    const select = container.querySelector("select")!;
    await act(async () => {
      select.value = "formula";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(container.querySelector("textarea")?.value).toBe(defaults.expression);
    await act(async () =>
      container
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    );
    expect(sendProtocolRequest).toHaveBeenCalledWith(
      { type: "set_xp_progression", progression: { ...defaults, mode: "formula" } },
      "Save XP progression"
    );
    await act(async () =>
      root.render(
        <XpProgressionEditor client={client} progression={{ ...defaults, base_xp: 250 }} />
      )
    );
    expect(container.querySelector("select")?.value).toBe("tuning");
    expect(container.querySelector("input")?.value).toBe("250");
    await act(async () => root.unmount());
  });

  it("updates the graph from unsaved settings without sending a request", async () => {
    const { container, root, client, sendProtocolRequest } = await mount();
    await act(async () =>
      root.render(<XpProgressionEditor client={client} progression={defaults} />)
    );
    const before = container.querySelector("polyline")?.getAttribute("points");
    expect(container.textContent).toContain("100 XP needed");
    const milestoneInput = container.querySelectorAll("form input")[3] as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
        milestoneInput,
        "2"
      );
      milestoneInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.querySelector("polyline")?.getAttribute("points")).not.toBe(before);
    expect(container.querySelector('input[aria-label="Inspect level"]')).not.toBeNull();
    expect(container.querySelector("form svg")).toBeNull();
    expect(sendProtocolRequest).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });

  it("renders backend remaining XP and unavailable goals", async () => {
    const { container, root, client } = await mount();
    await act(async () =>
      root.render(<SheetXpProgressBar client={client} instanceId="hero" sheetId="template" />)
    );
    expect(container.textContent).toContain("300 XP to level");
    store.state.uiState.xpTracker.sheets[0] = {
      instance_id: "hero",
      current_xp: 100,
      xp_required: 0,
      xp_remaining: 0,
      ready_to_level: false,
      goal_error: "XP goal unavailable."
    };
    await act(async () =>
      root.render(<SheetXpProgressBar client={client} instanceId="hero" sheetId="template" />)
    );
    expect(container.textContent).toContain("XP goal unavailable.");
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
    await act(async () => root.unmount());
  });
});
