import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ActiveCondition, Augmentation } from "@/domain/models";
import { SheetConditionsSection } from "@/features/sheets/components/SheetConditionsSection";

const condition: ActiveCondition = {
  application_id: "condition:instance-1:poisoned",
  condition_id: "poisoned",
  condition_name: "Poisoned",
  description: "Taking ongoing damage.",
  visibility: "public",
  instance_id: "instance-1",
  augmentation_ids: ["aug_1"],
  source: { type: "action", id: "throw_dart", label: "Throw Dart" },
  applied_at: "2026-07-09T12:00:00Z",
  applied_by_role: "dm",
  applied_at_state_version: 4
};

const augmentations: Record<string, Augmentation> = {
  aug_1: {
    id: "aug_1",
    name: "Poison penalty",
    source: { type: "condition" },
    scope: "instance",
    target: { root: "instance", path: ["arcane"] },
    effect: {
      type: "formula_modifier",
      operation: "subtract",
      value: { aliases: null, text: "2" }
    },
    lifecycle: { mode: "rounds", remaining: 3 }
  }
};

describe("SheetConditionsSection", () => {
  it("shows source and timing metadata to the GM but not to players", () => {
    const gmMarkup = renderToStaticMarkup(
      <SheetConditionsSection
        conditions={[condition]}
        augmentations={augmentations}
        mode="gm"
        canRemove={true}
        onRemove={() => undefined}
      />
    );
    expect(gmMarkup).toContain("Duration: Rounds · 3 remaining");
    expect(gmMarkup).toContain("Source: Throw Dart");
    expect(gmMarkup).toContain("by dm");

    const playerMarkup = renderToStaticMarkup(
      <SheetConditionsSection
        conditions={[condition]}
        augmentations={augmentations}
        mode="player"
        canRemove={false}
        onRemove={() => undefined}
      />
    );
    expect(playerMarkup).toContain("Duration: Rounds · 3 remaining");
    expect(playerMarkup).not.toContain("Source:");
    expect(playerMarkup).not.toContain("<button");
  });
});
