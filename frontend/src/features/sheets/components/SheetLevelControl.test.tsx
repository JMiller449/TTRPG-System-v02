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

  it("opens the GM editor on demand and saves only positive whole levels", async () => {
    const onSave = vi.fn();
    await act(async () => {
      root.render(<SheetLevelControl level={2} canEdit onSave={onSave} />);
    });

    expect(container.querySelector("input")).toBeNull();
    const edit = container.querySelector<HTMLButtonElement>('[aria-label^="Edit character level"]');
    await act(async () => edit?.click());

    const input = container.querySelector<HTMLInputElement>("input");
    const save = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Save"
    );
    expect(input?.value).toBe("2");
    expect(save?.disabled).toBe(true);

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "3.5");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(save?.disabled).toBe(true);

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "3");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(save?.disabled).toBe(false);
    await act(async () => save?.click());
    expect(onSave).toHaveBeenCalledWith(3);
    expect(container.querySelector("input")).toBeNull();
  });

  it("cancels an open GM editor without saving", async () => {
    const onSave = vi.fn();
    await act(async () => {
      root.render(<SheetLevelControl level={4} canEdit onSave={onSave} />);
    });

    await act(async () =>
      container.querySelector<HTMLButtonElement>('[aria-label^="Edit character level"]')?.click()
    );
    const input = container.querySelector<HTMLInputElement>("input");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "5");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () =>
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent === "Cancel")
        ?.click()
    );

    expect(onSave).not.toHaveBeenCalled();
    expect(container.querySelector("input")).toBeNull();
    expect(container.textContent).toContain("4");
  });
});
