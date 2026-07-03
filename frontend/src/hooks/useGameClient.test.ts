import { describe, expect, it } from "vitest";
import {
  buildIntentErrorMessage,
  buildIntentSuccessMessage,
  requestResolvesOnSnapshot,
  requestUsesQuietFeedback
} from "@/hooks/useGameClient";

describe("useGameClient feedback messages", () => {
  it("uses explicit recovery wording for resync success", () => {
    expect(buildIntentSuccessMessage("State resync")).toBe("State resynced.");
  });

  it("describes backend request errors as rejected intents", () => {
    expect(
      buildIntentErrorMessage({
        label: "Perform action: Fire Bolt",
        message: "Action is not assigned to this sheet.",
        requestId: "req-action",
        isRoll20BridgeError: false
      })
    ).toBe("Perform action: Fire Bolt rejected: Action is not assigned to this sheet.");
  });

  it("keeps transport and bridge failures distinct from backend rejections", () => {
    expect(
      buildIntentErrorMessage({
        label: "Transport",
        message: "Connection closed",
        isRoll20BridgeError: false
      })
    ).toBe("Transport error: Connection closed");

    expect(
      buildIntentErrorMessage({
        label: "Perform action: Fire Bolt",
        message: "Roll20 chat bridge is not connected.",
        requestId: "req-action",
        isRoll20BridgeError: true
      })
    ).toBe(
      "Perform action: Fire Bolt failed: Roll20 bridge disconnected. Open Roll20 with the extension loaded, then confirm the extension options use ws://127.0.0.1:6767/ws/chat and the backend SERVICE_AUTH_CODE (local default: service)."
    );
  });

  it("waits for terminal action and generated-code events instead of resolving from patches", () => {
    expect(
      requestResolvesOnSnapshot({
        type: "perform_action",
        sheet_id: "instance-1",
        action_id: "attack"
      })
    ).toBe(false);
    expect(
      requestResolvesOnSnapshot({
        type: "create_instanced_sheet",
        instance_id: "instance-1",
        parent_sheet_id: "sheet-1",
        health: 10,
        mana: 5,
        generate_access_code: true
      })
    ).toBe(false);
    expect(
      requestResolvesOnSnapshot({
        type: "set_instanced_sheet_resource",
        instance_id: "instance-1",
        resource: "health",
        value: 8
      })
    ).toBe(true);
  });

  it("keeps background reads quiet while mutations and recovery remain visible", () => {
    expect(
      requestUsesQuietFeedback({
        type: "get_action_formula_authoring_metadata"
      })
    ).toBe(true);
    expect(
      requestUsesQuietFeedback({
        type: "get_augmentation_target_metadata",
        context: "condition_template"
      })
    ).toBe(true);
    expect(requestUsesQuietFeedback({ type: "get_xp_tracker" })).toBe(true);
    expect(
      requestUsesQuietFeedback({
        type: "delete_fact",
        fact_id: "fact-1"
      })
    ).toBe(false);
    expect(requestUsesQuietFeedback({ type: "resync_state" })).toBe(false);
  });
});
