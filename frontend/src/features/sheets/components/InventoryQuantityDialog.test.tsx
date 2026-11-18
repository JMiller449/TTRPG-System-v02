// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InventoryQuantityDialog } from "@/features/sheets/components/InventoryQuantityDialog";

describe("InventoryQuantityDialog", () => {
  const roots: Array<ReturnType<typeof createRoot>> = [];

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(async () => {
    await act(async () => {
      roots.splice(0).forEach((root) => root.unmount());
    });
    document.body.innerHTML = "";
  });

  async function renderDialog(currentCount = 10) {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);
    const onChange = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <InventoryQuantityDialog
          itemName="Arrow"
          currentCount={currentCount}
          onChange={onChange}
          onClose={onClose}
        />
      );
    });

    return { container, onChange, onClose };
  }

  async function enterAmount(input: HTMLInputElement, value: string): Promise<void> {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  it("adds the entered amount", async () => {
    const { container, onChange, onClose } = await renderDialog();
    const input = container.querySelector<HTMLInputElement>('input[type="number"]')!;

    await enterAmount(input, "90");
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    });

    expect(onChange).toHaveBeenCalledWith(100);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("subtracts the entered amount and clamps at zero", async () => {
    const { container, onChange } = await renderDialog(10);
    const input = container.querySelector<HTMLInputElement>('input[type="number"]')!;

    await enterAmount(input, "90");
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent?.trim() === "Subtract")!
        .click();
    });

    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("rejects non-positive and fractional amounts", async () => {
    const { container, onChange } = await renderDialog();
    const input = container.querySelector<HTMLInputElement>('input[type="number"]')!;
    const add = container.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const subtract = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Subtract"
    )!;

    for (const value of ["0", "1.5"]) {
      await enterAmount(input, value);
      expect(add.disabled).toBe(true);
      expect(subtract.disabled).toBe(true);
    }

    expect(onChange).not.toHaveBeenCalled();
  });
});
