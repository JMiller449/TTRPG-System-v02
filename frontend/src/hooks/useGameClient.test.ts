import { describe, expect, it } from "vitest";
import {
  buildIntentErrorMessage,
  buildIntentSuccessMessage
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
      "Perform action: Fire Bolt failed: Roll20 bridge disconnected. Open Roll20 with the extension loaded before trying again."
    );
  });
});
