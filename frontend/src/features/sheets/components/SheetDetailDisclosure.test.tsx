import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SheetDetailDisclosure } from "@/features/sheets/components/SheetDetailDisclosure";

describe("SheetDetailDisclosure", () => {
  it("renders a closed disclosure with an optional item count", () => {
    const markup = renderToStaticMarkup(
      <SheetDetailDisclosure title="Attributes" count={4}>
        <p>Attribute editor</p>
      </SheetDetailDisclosure>
    );

    expect(markup).toContain("<details");
    expect(markup).not.toContain("open=");
    expect(markup).toContain("Attributes");
    expect(markup).toContain(">4</span>");
    expect(markup).toContain("Attribute editor");
  });
});
