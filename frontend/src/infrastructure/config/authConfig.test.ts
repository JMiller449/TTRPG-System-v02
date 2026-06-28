import { describe, expect, it } from "vitest";
import { resolveDefaultAuthToken } from "@/infrastructure/config/authConfig";

describe("authConfig", () => {
  it("uses explicit frontend env auth tokens when provided", () => {
    expect(
      resolveDefaultAuthToken("player", {
        VITE_PLAYER_AUTH_TOKEN: " custom-player ",
        VITE_DM_AUTH_TOKEN: "custom-dm"
      })
    ).toBe("custom-player");
    expect(
      resolveDefaultAuthToken("gm", {
        VITE_PLAYER_AUTH_TOKEN: "custom-player",
        VITE_DM_AUTH_TOKEN: " custom-dm "
      })
    ).toBe("custom-dm");
  });

  it("does not compile fallback auth tokens when env values are missing", () => {
    expect(resolveDefaultAuthToken("player", {})).toBeNull();
    expect(resolveDefaultAuthToken("gm", {})).toBeNull();
  });
});
