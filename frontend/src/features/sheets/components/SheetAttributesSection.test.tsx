// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SheetAttributesSection } from "@/features/sheets/components/SheetAttributesSection";

const definitions = {
  amount_of_reactions: {
    id: "amount_of_reactions",
    name: "Amount of Reactions",
    description: "Informational reaction amount.",
    subject_types: ["sheet" as const],
    value_type: "number" as const,
    default_value: {
      type: "formula" as const,
      formula: { aliases: null, text: "1" }
    },
    unit: "reactions",
    required: true
  }
};

const bridges = {
  amount_of_reactions: {
    relationship_id: "required_attribute_amount_of_reactions",
    attribute_id: "amount_of_reactions",
    value: {
      type: "formula" as const,
      formula: {
        aliases: [{ name: "registration", path: ["stats", "registration"] }],
        text: "@registration + 2"
      }
    },
    evaluated_value: 12,
    evaluation_error: null
  }
};

describe("SheetAttributesSection", () => {
  it("renders the authoritative value without edit controls for players", () => {
    const markup = renderToStaticMarkup(
      <SheetAttributesSection
        definitions={definitions}
        bridges={bridges}
        canEdit={false}
        onSaveFormula={() => undefined}
        onReset={() => undefined}
      />
    );

    expect(markup).toContain("Amount of Reactions");
    expect(markup).toContain("12 reactions");
    expect(markup).toContain("Required");
    expect(markup).not.toContain("<button");
  });

  it("renders formula editing and reset controls for a GM", () => {
    const markup = renderToStaticMarkup(
      <SheetAttributesSection
        definitions={definitions}
        bridges={bridges}
        canEdit
        onSaveFormula={() => undefined}
        onReset={() => undefined}
      />
    );

    expect(markup).toContain("@registration + 2");
    expect(markup).toContain("Save Formula");
    expect(markup).toContain("Reset to Default");
  });

  it("uses compact summary cards with formula help in page layout", () => {
    const markup = renderToStaticMarkup(
      <SheetAttributesSection
        definitions={definitions}
        bridges={bridges}
        canEdit={false}
        pageLayout
        onSaveFormula={() => undefined}
        onReset={() => undefined}
      />
    );

    expect(markup).toContain("sheet-attributes--page");
    expect(markup).toContain("sheet-attribute-summary");
    expect(markup).toContain('aria-label="Attribute values"');
    expect(markup).toContain("Informational reaction amount.");
    expect(markup).toContain("Formula:");
    expect(markup).toContain("@registration + 2");
    expect(markup).toContain("@registration → stats.registration");
    expect(markup).not.toContain("sheet-attributes-title");
  });

  it("moves page-layout attachment and creation into focused actions", () => {
    const markup = renderToStaticMarkup(
      <SheetAttributesSection
        definitions={{
          ...definitions,
          optional_note: {
            id: "optional_note",
            name: "Optional Note",
            description: "Optional text.",
            subject_types: ["sheet"],
            value_type: "text",
            default_value: { type: "text", value: "" },
            required: false
          }
        }}
        bridges={bridges}
        canEdit
        pageLayout
        onSaveFormula={() => undefined}
        onReset={() => undefined}
        onAttach={() => undefined}
        onCreateNew={() => undefined}
      />
    );

    expect(markup).toContain("sheet-attributes__toolbar");
    expect(markup).toContain(">Add Existing</button>");
    expect(markup).toContain(">Create Attribute</button>");
    expect(markup).not.toContain("Search Attribute catalog");
    expect(markup).not.toContain("Save Formula");
  });

  it("opens focused add and edit dialogs from compact page cards", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onAttach = vi.fn();
    const onCreateNew = vi.fn();

    await act(async () => {
      root.render(
        <SheetAttributesSection
          definitions={{
            ...definitions,
            optional_note: {
              id: "optional_note",
              name: "Optional Note",
              description: "Optional text.",
              subject_types: ["sheet"],
              value_type: "text",
              default_value: { type: "text", value: "" },
              required: false
            }
          }}
          bridges={bridges}
          canEdit
          pageLayout
          onSaveFormula={() => undefined}
          onReset={() => undefined}
          onAttach={onAttach}
          onCreateNew={onCreateNew}
        />
      );
    });

    const editButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label^="Edit Amount of Reactions"]'
    );
    await act(async () => editButton?.click());
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain(
      "Edit Amount of Reactions"
    );
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("Save Formula");

    const closeEditButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Close Edit Amount of Reactions"]'
    );
    await act(async () => closeEditButton?.click());

    const addExistingButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Add Existing"
    );
    await act(async () => addExistingButton?.click());
    const picker = container.querySelector<HTMLInputElement>(
      '[role="dialog"] input[role="combobox"]'
    );
    await act(async () => picker?.focus());
    const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((entry) =>
      entry.textContent?.includes("Optional Note")
    );
    await act(async () => option?.click());
    const addButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Add Attribute"
    );
    await act(async () => addButton?.click());
    expect(onAttach).toHaveBeenCalledWith("optional_note");
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    const createButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Create Attribute"
    );
    await act(async () => createButton?.click());
    expect(onCreateNew).toHaveBeenCalledOnce();

    await act(async () => root.unmount());
    container.remove();
  });

  it("renders validated physical damage types as a multi-value dropdown", () => {
    const markup = renderToStaticMarkup(
      <SheetAttributesSection
        definitions={{
          weapon_damage_types: {
            id: "weapon_damage_types",
            name: "Physical Damage Types",
            description: "Physical damage types this weapon can deal.",
            subject_types: ["item"],
            value_type: "list",
            default_value: { type: "list", value: [] },
            validation_options: ["Slashing", "Bludgeoning", "Piercing"],
            required: true,
            required_profile: "weapon"
          }
        }}
        bridges={{
          weapon_damage_types: {
            relationship_id: "required_attribute_weapon_damage_types",
            attribute_id: "weapon_damage_types",
            value: { type: "list", value: ["Slashing"] },
            evaluated_value: ["Slashing"],
            evaluation_error: null
          }
        }}
        canEdit
        draftMode
        subjectType="item"
        onSaveFormula={() => undefined}
        onSaveValue={() => undefined}
        onReset={() => undefined}
      />
    );

    expect(markup).toContain('aria-label="Physical Damage Types option"');
    expect(markup).toContain('<option value="Slashing" disabled="">Slashing</option>');
    expect(markup).toContain('<option value="Bludgeoning">Bludgeoning</option>');
    expect(markup).toContain('<option value="Piercing">Piercing</option>');
    expect(markup).toContain('aria-label="Remove Slashing"');
    expect(markup).not.toContain("Allowed values:");
  });
});
