import { describe, expect, it } from "vitest";
import { initialState } from "@/app/state/initialState";
import { connectionReducer } from "@/app/state/reducer/connectionReducer";

describe("connectionReducer", () => {
  it("clears only matching stale connection errors", () => {
    const bridgeErrorState = connectionReducer(initialState, {
      type: "connection_error",
      error: "Roll20 chat bridge is not connected."
    });
    const cleared = connectionReducer(bridgeErrorState ?? initialState, {
      type: "clear_connection_error_matching",
      text: "roll20 chat bridge"
    });
    expect(cleared?.uiState.connection.error).toBeUndefined();

    const unrelatedErrorState = connectionReducer(initialState, {
      type: "connection_error",
      error: "Websocket connection closed."
    });
    const preserved = connectionReducer(unrelatedErrorState ?? initialState, {
      type: "clear_connection_error_matching",
      text: "roll20 chat bridge"
    });
    expect(preserved?.uiState.connection.error).toBe("Websocket connection closed.");
  });
});
