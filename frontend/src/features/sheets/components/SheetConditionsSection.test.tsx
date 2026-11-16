// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ActiveCondition, Augmentation, ConditionPreset } from "@/domain/models";
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

const bleeding: ConditionPreset = {
  id: "bleeding",
  name: "Bleeding",
  description: "Open wound.",
  visibility: "public",
  effect_ids: []
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

  it("lets the GM choose and directly apply a condition", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onAdd = vi.fn();

    await act(async () => {
      root.render(
        <SheetConditionsSection
          conditions={[condition]}
          augmentations={augmentations}
          mode="gm"
          canRemove
          onRemove={vi.fn()}
          conditionPresets={[
            {
              id: "poisoned",
              name: "Poisoned",
              description: "Already present.",
              visibility: "public",
              effect_ids: []
            },
            bleeding
          ]}
          canAdd
          onAdd={onAdd}
        />
      );
    });

    const addButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Add Condition"
    );
    await act(async () => addButton?.click());
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("Add Condition");

    const picker = container.querySelector<HTMLInputElement>(
      'input[placeholder="Search condition catalog"]'
    );
    await act(async () => picker?.focus());
    const options = [...document.body.querySelectorAll<HTMLElement>('[role="option"]')];
    expect(
      options.find((option) => option.textContent?.includes("Poisoned"))?.textContent
    ).toContain("Already active");
    const bleedingOption = options.find((option) => option.textContent?.includes("Bleeding"));
    await act(async () => bleedingOption?.click());

    const applyButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Apply Condition"
    );
    await act(async () => applyButton?.click());

    expect(onAdd).toHaveBeenCalledWith("bleeding");
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    await act(async () => root.unmount());
    container.remove();
  });
});
