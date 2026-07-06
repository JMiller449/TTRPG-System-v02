import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { initialState } from "@/app/state/initialState";
import { StoreContext } from "@/app/state/storeContext";
import type { AppState } from "@/app/state/types";
import type { ActionHistoryEntry, Sheet } from "@/domain/models";
import { RollLog } from "@/features/rolls/RollLog";

const ariaEntry: ActionHistoryEntry = {
  id: "history-aria",
  action_id: "dodge",
  action_name: "Dodge",
  actor_role: "player",
  actor_sheet_id: "sheet-aria",
  actor_instance_id: "instance-aria",
  created_at: "2026-07-05T12:00:00Z",
  state_version: 3,
  status: "success",
  summary: "Aria dodged."
};

const borinEntry: ActionHistoryEntry = {
  ...ariaEntry,
  id: "history-borin",
  action_name: "Block",
  actor_sheet_id: "sheet-borin",
  actor_instance_id: "instance-borin",
  summary: "Borin blocked."
};

const otherAriaInstanceEntry: ActionHistoryEntry = {
  ...ariaEntry,
  id: "history-other-aria",
  actor_instance_id: "instance-other-aria",
  summary: "Another Aria instance acted."
};

function renderRollLog(props: { sheetId?: string; instanceId?: string } = {}): string {
  const state: AppState = {
    ...initialState,
    serverState: {
      ...initialState.serverState,
      sheets: {
        "sheet-aria": { id: "sheet-aria", name: "Aria" } as Sheet,
        "sheet-borin": { id: "sheet-borin", name: "Borin" } as Sheet
      },
      actionHistory: {
        [ariaEntry.id]: ariaEntry,
        [borinEntry.id]: borinEntry,
        [otherAriaInstanceEntry.id]: otherAriaInstanceEntry
      },
      actionHistoryOrder: [ariaEntry.id, borinEntry.id, otherAriaInstanceEntry.id]
    }
  };

  return renderToStaticMarkup(
    <StoreContext.Provider value={{ state, dispatch: () => undefined }}>
      <RollLog {...props} />
    </StoreContext.Provider>
  );
}

describe("RollLog", () => {
  it("shows the global stream with actor character and role", () => {
    const markup = renderRollLog();

    expect(markup).toContain("Aria (instance-aria) · Player");
    expect(markup).toContain("Borin (instance-borin) · Player");
  });

  it("filters a character history tab to its sheet and instance", () => {
    const markup = renderRollLog({ sheetId: "sheet-aria", instanceId: "instance-aria" });

    expect(markup).toContain("Aria dodged.");
    expect(markup).not.toContain("Borin blocked.");
    expect(markup).not.toContain("Another Aria instance acted.");
  });
});
