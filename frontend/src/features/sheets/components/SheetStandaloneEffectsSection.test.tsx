import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ActiveStandaloneEffect } from "@/app/state/selectors";
import { SheetStandaloneEffectsSection } from "@/features/sheets/components/SheetStandaloneEffectsSection";

const activeEffect: ActiveStandaloneEffect = {
  application: {
    application_id: "standalone:instance-1:blessing",
    definition_id: "blessing",
    instance_id: "instance-1",
    source: {
      type: "action",
      id: "ward",
      relationship_id: "apply_blessing"
    },
    active: true
  },
  definition: {
    id: "blessing",
    name: "Blessing",
    description: "Temporary protection.",
    scope: "instance",
    target: { root: "instance", path: ["health"] },
    effect: {
      type: "formula_modifier",
      operation: "add",
      value: { aliases: null, text: "5" }
    },
    active: true
  },
  sourceAction: {
    id: "ward",
    name: "Protective Ward",
    steps: [
      {
        step_id: "apply_blessing",
        augmentation_id: "blessing",
        operation: "apply",
        type: "apply_augmentation"
      }
    ]
  },
  sourceStep: {
    step_id: "apply_blessing",
    augmentation_id: "blessing",
    operation: "apply",
    type: "apply_augmentation"
  }
};

describe("SheetStandaloneEffectsSection", () => {
  it("shows active effect mechanics and its action-step source without removal controls", () => {
    const markup = renderToStaticMarkup(<SheetStandaloneEffectsSection effects={[activeEffect]} />);

    expect(markup).toContain("Blessing");
    expect(markup).toContain("mutate: add 5 on instance.health");
    expect(markup).toContain("Protective Ward · Apply or remove effect (apply_blessing)");
    expect(markup).not.toContain("<button");
  });
});
