// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { AssignedSheetAction } from "@/app/state/selectors";
import { SheetActionsSection } from "@/features/sheets/components/SheetActionsSection";

describe("SheetActionsSection", () => {
  it("persists a deliberate pin selection instead of treating the first actions as pinned", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    const root = createRoot(container);
    const onPinnedActionIdsChange = vi.fn();
    const action: AssignedSheetAction = {
      relationshipId: "assigned_action",
      actionId: "action",
      action: { id: "action", name: "Action", steps: [] }
    };

    await act(async () => {
      root.render(
        <SheetActionsSection
          assignedActions={[action]}
          actionDefinitions={{ action: action.action }}
          attributeDefinitions={{}}
          actionOrder={["action"]}
          canEdit={false}
          pinnedActionIds={[]}
          onPinnedActionIdsChange={onPinnedActionIdsChange}
          onCreate={() => undefined}
          onUpdate={() => undefined}
          onDelete={() => undefined}
          onPerformAction={() => undefined}
        />
      );
    });

    const pinButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Pin"
    );
    await act(async () => pinButton?.click());
    expect(onPinnedActionIdsChange).toHaveBeenCalledWith(["assigned_action"]);
    await act(async () => root.unmount());
  });

  it("lets the acting player choose GM-only output for one invocation", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    const root = createRoot(container);
    const onPerformAction = vi.fn();
    const assignedAction: AssignedSheetAction = {
      relationshipId: "assigned_arcane_check",
      actionId: "arcane_check",
      action: {
        id: "arcane_check",
        name: "Arcane Check",
        roll_mode_kind: "check",
        steps: []
      }
    };

    await act(async () => {
      root.render(
        <SheetActionsSection
          assignedActions={[assignedAction]}
          actionDefinitions={{ arcane_check: assignedAction.action }}
          attributeDefinitions={{}}
          actionOrder={["arcane_check"]}
          canEdit={false}
          onCreate={() => undefined}
          onUpdate={() => undefined}
          onDelete={() => undefined}
          onPerformAction={onPerformAction}
        />
      );
    });

    const gmButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "GM Only"
    );
    expect(gmButton).not.toBeUndefined();
    await act(async () => gmButton?.click());

    const actionButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label^="Perform Arcane Check"]'
    );
    expect(actionButton?.getAttribute("aria-label")).toContain("GM-only");
    await act(async () => actionButton?.click());

    expect(onPerformAction).toHaveBeenCalledWith(assignedAction, "normal", "gm");
    await act(async () => root.unmount());
  });

  it("requires confirmation before removing an action assignment", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    const root = createRoot(container);
    const onDelete = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const assignedAction: AssignedSheetAction = {
      relationshipId: "assigned_arcane_check",
      actionId: "arcane_check",
      action: { id: "arcane_check", name: "Arcane Check", steps: [] },
      bridge: { relationship_id: "assigned_arcane_check", entry_id: "arcane_check" }
    };

    await act(async () => {
      root.render(
        <SheetActionsSection
          assignedActions={[assignedAction]}
          actionDefinitions={{ arcane_check: assignedAction.action }}
          attributeDefinitions={{}}
          actionOrder={["arcane_check"]}
          canEdit
          onCreate={() => undefined}
          onUpdate={() => undefined}
          onDelete={onDelete}
          onPerformAction={() => undefined}
        />
      );
    });

    const removeButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Remove"
    );
    await act(async () => removeButton?.click());
    expect(onDelete).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledWith(
      "Remove “Arcane Check”?\n\nThis removes the action assignment from the selected character."
    );

    confirm.mockReturnValue(true);
    await act(async () => removeButton?.click());
    expect(onDelete).toHaveBeenCalledWith("assigned_arcane_check");

    await act(async () => root.unmount());
    confirm.mockRestore();
  });
});
