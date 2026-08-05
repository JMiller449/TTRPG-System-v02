// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SheetProficienciesSection } from "@/features/sheets/components/SheetProficienciesSection";

const longsword = {
  id: "longsword",
  name: "Longsword",
  description: "Training with long swords.",
  category: "weapon_family" as const,
  default_growth_rate: 0.01
};

const assignedLongsword = {
  relationship_id: "longsword",
  prof_id: "longsword",
  use_count: 3,
  growth_rate: 0.125
};

describe("SheetProficienciesSection", () => {
  it("shows the current capped proficiency percentage", () => {
    const markup = renderToStaticMarkup(
      <SheetProficienciesSection
        proficiencyDefinitions={{
          longsword
        }}
        proficiencyOrder={["longsword"]}
        sheetProficiencies={[assignedLongsword]}
        canEdit={false}
        onCreate={() => undefined}
        onUpdate={() => undefined}
        onDelete={() => undefined}
      />
    );

    expect(markup).toContain("37.50%");
    expect(markup).toContain("3 uses");
    expect(markup).toContain("Growth 0.125");
  });

  it("leaves the visible title to its page header", () => {
    const markup = renderToStaticMarkup(
      <SheetProficienciesSection
        proficiencyDefinitions={{}}
        proficiencyOrder={[]}
        sheetProficiencies={[]}
        canEdit={false}
        onCreate={() => undefined}
        onUpdate={() => undefined}
        onDelete={() => undefined}
      />
    );

    expect(markup).toContain('aria-label="Proficiency assignments"');
    expect(markup).toContain("No proficiencies assigned yet.");
    expect(markup).not.toContain("<h4");
  });

  it("moves assignment, creation, and progression editing into focused dialogs", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onCreate = vi.fn();
    const onOpenCreateProficiency = vi.fn();

    await act(async () => {
      root.render(
        <SheetProficienciesSection
          proficiencyDefinitions={{
            longsword,
            alchemy: {
              id: "alchemy",
              name: "Alchemy",
              description: "Potion and reagent training.",
              category: "custom",
              default_growth_rate: 0.02
            }
          }}
          proficiencyOrder={["longsword", "alchemy"]}
          sheetProficiencies={[assignedLongsword]}
          canEdit
          onCreate={onCreate}
          onOpenCreateProficiency={onOpenCreateProficiency}
          onUpdate={() => undefined}
          onDelete={() => undefined}
        />
      );
    });

    expect(container.textContent).toContain("1 assigned");
    expect(container.querySelector(".sheet-proficiency-grid input")).toBeNull();

    const editButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label^="Edit Longsword"]'
    );
    await act(async () => editButton?.click());
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("Edit Longsword");
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("Save Assignment");

    const closeEditButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Close Edit Longsword"]'
    );
    await act(async () => closeEditButton?.click());

    const addExistingButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Add Existing"
    );
    await act(async () => addExistingButton?.click());
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain(
      "Add Existing Proficiency"
    );
    const addButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Add Proficiency"
    );
    await act(async () => addButton?.click());
    expect(onCreate).toHaveBeenCalledWith({
      relationship_id: "alchemy",
      prof_id: "alchemy",
      use_count: 0,
      growth_rate: 1
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    const createButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Create Proficiency"
    );
    await act(async () => createButton?.click());
    expect(onOpenCreateProficiency).toHaveBeenCalledOnce();

    await act(async () => root.unmount());
    container.remove();
  });
});
