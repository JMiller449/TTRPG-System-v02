import { describe, expect, it } from "vitest";
import { buildUndoLastStateChangeSubmission } from "@/features/stateSync/StateSafetyPanel";

describe("StateSafetyPanel", () => {
  it("builds the GM undo request submission", () => {
    expect(buildUndoLastStateChangeSubmission()).toEqual({
      request: {
        type: "undo_last_state_change"
      },
      label: "Undo last state change"
    });
  });
});
