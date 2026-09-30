import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActionPointRefillDialog } from "@/features/sheets/components/ActionPointRefillDialog";

describe("ActionPointRefillDialog", () => {
  it("explains the refill amount and that the selected action will continue", () => {
    const markup = renderToStaticMarkup(
      <ActionPointRefillDialog
        actionName="Power Strike"
        characterName="Mara"
        maximumPoints={3}
        onConfirm={() => undefined}
        onClose={() => undefined}
      />
    );

    expect(markup).toContain("Refill action points?");
    expect(markup).toContain("Mara has no action/reaction points available for Power Strike.");
    expect(markup).toContain("Refill the pool to 3");
    expect(markup).toContain("Refill and continue");
    expect(markup).toContain("Cancel");
  });
});
