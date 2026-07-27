import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlayerBridgeInstallPanel } from "@/features/auth/PlayerEntry";

describe("PlayerBridgeInstallPanel", () => {
  it("gives players direct userscript installation links before sheet claim", () => {
    const markup = renderToStaticMarkup(
      <PlayerBridgeInstallPanel installUrl="https://example.test/roll20-bridge.user.js" />
    );

    expect(markup).toContain("Roll20 Bridge Setup");
    expect(markup).toContain("Install Violentmonkey");
    expect(markup).toContain("Install Roll20 Bridge");
    expect(markup).toContain('href="https://example.test/roll20-bridge.user.js"');
    expect(markup).toContain("Install / Sync Bridge");
  });
});
