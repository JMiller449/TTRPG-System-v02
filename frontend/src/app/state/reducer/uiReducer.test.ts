import { describe, expect, it } from "vitest";
import { initialState } from "@/app/state/initialState";
import { uiReducer } from "@/app/state/reducer/uiReducer";
import type { ActionFormulaAuthoringMetadata, AugmentationTargetMetadata } from "@/domain/ipc";

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
  action_preset_templates: [],
  action_attribute_presets: []
};

const augmentationTargetMetadata: AugmentationTargetMetadata = {
  targets: [
    {
      key: "instance.health",
      label: "Current Health",
      root: "instance",
      path: ["health"],
      value_type: "resource",
      description: "Current instance resource: Current Health.",
      allowed_contexts: ["runtime", "item_template", "condition_template"]
    }
  ],
  context: "condition_template"
};

describe("uiReducer", () => {
  it("keeps the template being edited as local UI navigation state", () => {
    const editingState = uiReducer(initialState, {
      type: "set_template_builder_sheet",
      sheetId: "template_1"
    });
    const resetState = uiReducer(editingState ?? initialState, { type: "reset_session_ui" });

    expect(editingState?.uiState.templateBuilderSheetId).toBe("template_1");
    expect(resetState?.uiState.templateBuilderSheetId).toBeNull();
  });

  it("stores Roll20 bridge status in UI state", () => {
    const state = uiReducer(initialState, {
      type: "set_roll20_bridge_status",
      status: "disconnected",
      checkedAt: "2026-06-18T12:00:00Z",
      error: "Roll20 chat bridge is not connected."
    });

    expect(state?.uiState.roll20Bridge).toEqual({
      status: "disconnected",
      lastCheckedAt: "2026-06-18T12:00:00Z",
      lastError: "Roll20 chat bridge is not connected."
    });
  });

  it("stores action/formula authoring metadata in UI state", () => {
    const state = uiReducer(initialState, {
      type: "set_action_formula_authoring_metadata",
      metadata
    });

    expect(state?.uiState.actionFormulaAuthoringMetadata).toEqual(metadata);
  });

  it("stores active sheet access codes for GM provisioning", () => {
    const state = uiReducer(initialState, {
      type: "set_sheet_access_codes",
      codes: [
        {
          code: "MAGE2026",
          sheetId: "mage-template",
          instanceId: "mage-instance",
          active: true
        }
      ]
    });

    expect(state?.uiState.sheetAccessCodes[0]?.code).toBe("MAGE2026");
  });

  it("stores augmentation target metadata in UI state", () => {
    const state = uiReducer(initialState, {
      type: "set_augmentation_target_metadata",
      metadata: augmentationTargetMetadata
    });

    expect(state?.uiState.augmentationTargetMetadata).toEqual(augmentationTargetMetadata);
  });

  it("stores and resets the XP tracker read model", () => {
    const tracker = {
      can_manage: false,
      parties: [],
      kills: [],
      adjustments: [],
      mobs: [],
      sheets: [
        {
          instance_id: "hero_1",
          sheet_id: "hero",
          name: "Hero",
          kills: [],
          adjustments: [],
          current_xp: 0,
          xp_required: 0,
          ready_to_level: false
        }
      ]
    };
    const stateWithTracker = uiReducer(initialState, {
      type: "set_xp_tracker",
      tracker
    });
    const resetState = uiReducer(stateWithTracker ?? initialState, {
      type: "reset_session_ui"
    });

    expect(stateWithTracker?.uiState.xpTracker).toEqual(tracker);
    expect(resetState?.uiState.xpTracker).toBeNull();
  });

  it("clears stored authoring metadata on session UI reset", () => {
    const stateWithMetadata = uiReducer(initialState, {
      type: "set_action_formula_authoring_metadata",
      metadata
    });
    const stateWithAugmentationMetadata = uiReducer(stateWithMetadata ?? initialState, {
      type: "set_augmentation_target_metadata",
      metadata: augmentationTargetMetadata
    });
    const resetState = uiReducer(stateWithAugmentationMetadata ?? initialState, {
      type: "reset_session_ui"
    });

    expect(resetState?.uiState.actionFormulaAuthoringMetadata).toBeNull();
    expect(resetState?.uiState.augmentationTargetMetadata).toBeNull();
  });

  it("clears Roll20 bridge status on session UI reset", () => {
    const stateWithStatus = uiReducer(initialState, {
      type: "set_roll20_bridge_status",
      status: "connected",
      checkedAt: "2026-06-18T12:00:00Z"
    });
    const resetState = uiReducer(stateWithStatus ?? initialState, {
      type: "reset_session_ui"
    });

    expect(resetState?.uiState.roll20Bridge).toEqual({ status: "unknown" });
  });
});
