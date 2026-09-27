// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SheetCoreStatPointDialog,
  SheetUnspentPointAdjustmentDialog
} from "./SheetCoreStatPointDialog";

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

describe("SheetCoreStatPointDialog", () => {
  it("submits a positive quantity instead of a resulting total", async () => {
    const onSubmit = vi.fn();
    await act(async () => {
      root.render(
        <SheetCoreStatPointDialog
          statName="strength"
          currentBase={10}
          onSubmit={onSubmit}
          onClose={() => undefined}
        />
      );
    });
    const quantity = container.querySelector<HTMLInputElement>('input[type="number"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
        quantity,
        "3"
      );
      quantity.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => container.querySelector<HTMLFormElement>("form")?.requestSubmit());
    expect(onSubmit).toHaveBeenCalledWith({
      quantity: 3,
      operation: "add",
      source: "level_up",
      reason: ""
    });
    expect(container.textContent).toContain("Permanent base: 10");
  });

  it("submits a negative-direction manual correction for removed core-stat points", async () => {
    const onSubmit = vi.fn();
    await act(async () => {
      root.render(
        <SheetCoreStatPointDialog
          statName="strength"
          currentBase={10}
          onSubmit={onSubmit}
          onClose={() => undefined}
        />
      );
    });
    const operation = container.querySelector<HTMLSelectElement>("select")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(
        operation,
        "remove"
      );
      operation.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => container.querySelector<HTMLFormElement>("form")?.requestSubmit());
    expect(onSubmit).toHaveBeenCalledWith({
      quantity: 1,
      operation: "remove",
      source: "manual",
      reason: ""
    });
    expect(container.textContent).toContain("Points to remove");
  });

  it("uses the same additive flow for unspent points", async () => {
    await act(async () => {
      root.render(
        <SheetUnspentPointAdjustmentDialog
          currentUnspent={2}
          onSubmit={() => undefined}
          onClose={() => undefined}
        />
      );
    });
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain(
      "Grant Unspent Points"
    );
    expect(container.textContent).toContain("Current unspent pool: 2");
    expect(container.textContent).not.toContain("Resulting value");
  });

  it("caps an unspent-point removal at the authoritative available balance", async () => {
    const onSubmit = vi.fn();
    await act(async () => {
      root.render(
        <SheetUnspentPointAdjustmentDialog
          currentUnspent={2}
          operation="remove"
          onSubmit={onSubmit}
          onClose={() => undefined}
        />
      );
    });
    const quantity = container.querySelector<HTMLInputElement>('input[type="number"]')!;
    expect(quantity.max).toBe("2");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
        quantity,
        "3"
      );
      quantity.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => container.querySelector<HTMLFormElement>("form")?.requestSubmit());
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
