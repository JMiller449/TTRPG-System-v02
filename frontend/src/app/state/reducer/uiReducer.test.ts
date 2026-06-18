import { describe, expect, it } from "vitest";
import { initialState } from "@/app/state/initialState";
import { uiReducer } from "@/app/state/reducer/uiReducer";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";

const metadata: ActionFormulaAuthoringMetadata = {
  variables: [],
  formula_roots: ["sheet", "instance"],
  action_mutation_roots: ["instance"],
  formula_aliases: [],
  action_steps: [
    {
      type: "send_message",
      label: "Send Message",
      category: "roll20_output",
      allowed_targets: ["caster"],
      formula_fields: ["message"],
      path_catalog: "none"
    }
  ],
  action_preset_templates: []
};

describe("uiReducer", () => {
  it("stores action/formula authoring metadata in UI state", () => {
    const state = uiReducer(initialState, {
      type: "set_action_formula_authoring_metadata",
      metadata
    });

    expect(state?.uiState.actionFormulaAuthoringMetadata).toEqual(metadata);
  });

  it("clears stored authoring metadata on session UI reset", () => {
    const stateWithMetadata = uiReducer(initialState, {
      type: "set_action_formula_authoring_metadata",
      metadata
    });
    const resetState = uiReducer(stateWithMetadata ?? initialState, {
      type: "reset_session_ui"
    });

    expect(resetState?.uiState.actionFormulaAuthoringMetadata).toBeNull();
  });
});
