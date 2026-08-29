import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Panel } from "@/shared/ui/Panel";

describe("Panel", () => {
  it("renders visible heading chrome by default", () => {
    const markup = renderToStaticMarkup(<Panel title="Character Sheet">Content</Panel>);

    expect(markup).toContain("<h2>Character Sheet</h2>");
    expect(markup).not.toContain("panel--frameless");
  });

  it("uses the title as an accessible label without visible chrome when frameless", () => {
    const markup = renderToStaticMarkup(
      <Panel title="Spawned Sheet" variant="frameless">
        Content
      </Panel>
    );

    expect(markup).toContain('class="panel panel--frameless"');
    expect(markup).toContain('aria-label="Spawned Sheet"');
    expect(markup).not.toContain("<h2");
    expect(markup).toContain('<div class="panel__body">Content</div>');
  });

  it("keeps the visible heading while flattening workspace chrome", () => {
    const markup = renderToStaticMarkup(
      <Panel title="State Backup" variant="workspace">
        Content
      </Panel>
    );

    expect(markup).toContain('class="panel panel--workspace"');
    expect(markup).toContain("<h2>State Backup</h2>");
    expect(markup).not.toContain('aria-label="State Backup"');
  });
});
