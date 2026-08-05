// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { ModalDialog } from "@/shared/ui/ModalDialog";

describe("ModalDialog", () => {
  it("does not steal focus when controlled fields rerender the dialog", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const firstClose = vi.fn();
    const latestClose = vi.fn();

    await act(async () => {
      root.render(
        <ModalDialog title="Test" description="Focus test" onClose={firstClose}>
          <input aria-label="Enemy name" />
        </ModalDialog>
      );
    });
    const input = container.querySelector<HTMLInputElement>('[aria-label="Enemy name"]');
    input?.focus();
    expect(document.activeElement).toBe(input);

    await act(async () => {
      root.render(
        <ModalDialog title="Test" description="Focus test" onClose={latestClose}>
          <input aria-label="Enemy name" value="G" readOnly />
        </ModalDialog>
      );
    });
    expect(document.activeElement).toBe(input);

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(firstClose).not.toHaveBeenCalled();
    expect(latestClose).toHaveBeenCalledOnce();

    await act(async () => root.unmount());
    container.remove();
  });

  it("uses the latest pending state when handling Escape", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <ModalDialog title="Test" description="Pending test" onClose={onClose} pending>
          <input />
        </ModalDialog>
      );
    });
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => root.unmount());
    container.remove();
  });
});
