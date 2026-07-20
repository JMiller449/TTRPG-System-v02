// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  confirmDestructiveAction,
  destructiveActionMessage
} from "@/shared/ui/confirmDestructiveAction";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("confirmDestructiveAction", () => {
  it("builds a clear subject-specific consequence message", () => {
    expect(
      destructiveActionMessage({
        action: "Remove",
        subject: "Arcane Blade",
        consequence: "This removes the item from the character inventory."
      })
    ).toBe("Remove “Arcane Blade”?\n\nThis removes the item from the character inventory.");
  });

  it("returns the browser confirmation decision", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const accepted = confirmDestructiveAction({
      action: "Delete",
      subject: "Fireball",
      consequence: "This cannot be undone."
    });

    expect(accepted).toBe(false);
    expect(confirm).toHaveBeenCalledWith("Delete “Fireball”?\n\nThis cannot be undone.");
  });
});
