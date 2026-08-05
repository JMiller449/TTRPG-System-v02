// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialState } from "@/app/state/initialState";
import { StoreContext } from "@/app/state/storeContext";
import type { GameClient } from "@/hooks/useGameClient";
import { SheetManagementSection } from "@/features/sheets/components/SheetManagementSection";
import { deriveSnapshotTemplateId } from "@/features/sheets/snapshotTemplateId";

const sendProtocolRequest = vi.fn();
const client: GameClient = {
  connect: async () => undefined,
  disconnect: () => undefined,
  endSession: () => undefined,
  sendProtocolRequest,
  authenticate: () => undefined,
  authenticateWithCode: () => undefined,
  onEvent: () => () => undefined
};

let container: HTMLDivElement;
let root: Root;

function managementState() {
  return {
    ...initialState,
    uiState: {
      ...initialState.uiState,
      sheetAccessCodes: [
        {
          code: "FIGHTER1",
          sheetId: "fighter_template",
          instanceId: "fighter_instance",
          active: true
        }
      ]
    }
  };
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  sendProtocolRequest.mockReset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  vi.restoreAllMocks();
  container.remove();
});

describe("SheetManagementSection", () => {
  it("derives readable unique internal IDs from snapshot names", () => {
    expect(deriveSnapshotTemplateId("Mage Template Snapshot", [])).toBe("mage_template_snapshot");
    expect(
      deriveSnapshotTemplateId("Mage Template Snapshot", [
        "mage_template_snapshot",
        "mage_template_snapshot_2"
      ])
    ).toBe("mage_template_snapshot_3");
  });

  it("manages the selected player character's access code and lifecycle", async () => {
    await act(async () => {
      root.render(
        createElement(
          StoreContext.Provider,
          { value: { state: managementState(), dispatch: () => undefined } },
          createElement(SheetManagementSection, {
            client,
            instanceId: "fighter_instance",
            instanceName: "Fighter",
            parentSheetId: "fighter_template",
            kind: "player"
          })
        )
      );
    });

    expect(container.textContent).toContain("FIGHTER1");
    expect(sendProtocolRequest).toHaveBeenCalledWith(
      { type: "get_sheet_access_codes" },
      "Load player access code"
    );

    const rotateButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Rotate Code"
    );
    await act(async () => {
      rotateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(sendProtocolRequest).toHaveBeenCalledWith(
      {
        type: "generate_sheet_access_code",
        sheet_id: "fighter_template",
        instance_id: "fighter_instance"
      },
      "Rotate access code: Fighter"
    );

    expect(container.textContent).not.toContain("Template ID");
    const snapshotNameInput = container.querySelector<HTMLInputElement>(
      ".sheet-management__snapshot-fields input"
    );
    expect(snapshotNameInput?.value).toBe("Fighter Snapshot");
    const snapshotButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Create Template Snapshot"
    );
    await act(async () => {
      snapshotButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(sendProtocolRequest).toHaveBeenCalledWith(
      {
        type: "create_sheet_from_instance",
        instance_id: "fighter_instance",
        sheet_id: "fighter_snapshot",
        name: "Fighter Snapshot"
      },
      "Snapshot template: Fighter Snapshot"
    );

    const despawnButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.startsWith("Despawn Fighter")
    );
    await act(async () => {
      despawnButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(sendProtocolRequest).toHaveBeenCalledWith(
      { type: "delete_instanced_sheet", instance_id: "fighter_instance" },
      "Despawn Fighter"
    );
  });

  it("does not offer player access controls for an enemy sheet", async () => {
    await act(async () => {
      root.render(
        createElement(
          StoreContext.Provider,
          { value: { state: initialState, dispatch: () => undefined } },
          createElement(SheetManagementSection, {
            client,
            instanceId: "goblin_instance",
            instanceName: "Goblin",
            parentSheetId: "goblin_template",
            kind: "enemy"
          })
        )
      );
    });

    expect(container.textContent).toContain(
      "Enemy sheets are GM-only and do not need player access codes."
    );
    expect(container.textContent).not.toContain("Generate Code");
    expect(container.textContent).not.toContain("Rotate Code");
  });
});
