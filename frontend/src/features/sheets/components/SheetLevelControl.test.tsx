// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SheetLevelControl } from "@/features/sheets/components/SheetLevelControl";

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

describe("SheetLevelControl", () => {
  it("renders a read-only player level", async () => {
    await act(async () => {
      root.render(<SheetLevelControl level={6} canEdit={false} onSave={() => undefined} />);
    });

    expect(container.textContent).toContain("Level");
    expect(container.textContent).toContain("6");
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector("button")).toBeNull();
  });

  it("lets the GM save only positive whole levels", async () => {
    const onSave = vi.fn();
    await act(async () => {
      root.render(<SheetLevelControl level={2} canEdit onSave={onSave} />);
    });
    const input = container.querySelector<HTMLInputElement>("input");
    const save = container.querySelector<HTMLButtonElement>("button");
    expect(input?.value).toBe("2");
    expect(save?.disabled).toBe(true);

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "3");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(save?.disabled).toBe(false);
    await act(async () => save?.click());
    expect(onSave).toHaveBeenCalledWith(3);

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "3.5");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(save?.disabled).toBe(true);
  });
});
