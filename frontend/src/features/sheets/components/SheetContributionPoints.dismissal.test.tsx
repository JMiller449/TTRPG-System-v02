// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SheetContributionPoints } from "./SheetRuntimeResources";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("SheetContributionPoints dismissal", () => {
  it("keeps the editor open for inside clicks and dismisses it on click-away or Escape", async () => {
    await act(async () => {
      root.render(
        <SheetContributionPoints
          compact
          value={4}
          canManage
          onSet={() => undefined}
          onAdjust={() => undefined}
        />
      );
    });

    const details = container.querySelector<HTMLDetailsElement>("details");
    expect(container.textContent).not.toContain("Cancel");

    details!.open = true;
    await act(async () => {
      details?.querySelector("input")?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(details?.open).toBe(true);

    await act(async () => {
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(details?.open).toBe(false);

    details!.open = true;
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(details?.open).toBe(false);
  });
});
