import { describe, expect, it } from "vitest";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import {
  appendFormulaToken,
  buildVariablePickerEntries,
  filterVariablePickerEntries,
  upsertFormulaAlias,
  variablePathLabel
} from "@/features/variables/variablePicker";

const metadata: ActionFormulaAuthoringMetadata = {
  variables: [
    {
      key: "sheet.stats.arcane",
      label: "Arcane",
      root: "sheet",
      path: ["stats", "arcane"],
      value_type: "number",
      editable_roles: ["dm"],
      formula_backed: false,
      description: "Base sheet stat.",
      shortcuts: ["arc", "arcane"],
      formula_reference_allowed: true,
      action_mutation_allowed: true
    },
    {
      key: "sheet.stats.health",
      label: "Health Formula",
      root: "sheet",
      path: ["stats", "health"],
      value_type: "formula",
      editable_roles: ["dm"],
      formula_backed: true,
      description: "Formula-backed stat.",
      shortcuts: null,
      formula_reference_allowed: true,
      action_mutation_allowed: false
    },
    {
      key: "instance.mana",
      label: "Current Mana",
      root: "instance",
      path: ["mana"],
      value_type: "resource",
      editable_roles: ["player", "dm"],
      formula_backed: false,
      description: "Current instance resource.",
      shortcuts: ["mana"],
      formula_reference_allowed: true,
      action_mutation_allowed: true
    }
  ],
  formula_roots: ["sheet", "instance"],
  action_mutation_roots: ["sheet", "instance"],
  formula_aliases: [],
  action_steps: [],
  action_preset_templates: []
};

describe("variablePicker", () => {
  it("builds formula entries with tokens and alias paths", () => {
    const entries = buildVariablePickerEntries(metadata, "formula");
    const arcane = entries.find((entry) => entry.key === "sheet.stats.arcane");

    expect(entries).toHaveLength(3);
    expect(arcane).toMatchObject({
      label: "Arcane",
      token: "@arc",
      alias: {
        name: "arc",
        path: ["sheet", "stats", "arcane"]
      }
    });
    expect(variablePathLabel(arcane!)).toBe("sheet.stats.arcane");
  });

  it("filters mutation entries to backend-approved mutation paths", () => {
    const entries = buildVariablePickerEntries(metadata, "mutation");

    expect(entries.map((entry) => entry.key)).toEqual([
      "instance.mana",
      "sheet.stats.arcane"
    ]);
  });

  it("searches labels, paths, descriptions, and shortcuts", () => {
    const entries = buildVariablePickerEntries(metadata, "formula");

    expect(filterVariablePickerEntries(entries, "resource").map((entry) => entry.key)).toEqual([
      "instance.mana"
    ]);
    expect(filterVariablePickerEntries(entries, "stats.arcane").map((entry) => entry.key)).toEqual([
      "sheet.stats.arcane"
    ]);
  });

  it("appends formula tokens without changing blank spacing aggressively", () => {
    expect(appendFormulaToken("", "@arc")).toBe("@arc");
    expect(appendFormulaToken("@mana + 2  ", "@arc")).toBe("@mana + 2 @arc");
  });

  it("upserts formula aliases by alias name", () => {
    expect(
      upsertFormulaAlias(
        [
          {
            name: "arc",
            path: ["old"]
          }
        ],
        {
          name: "arc",
          path: ["sheet", "stats", "arcane"]
        }
      )
    ).toEqual([
      {
        name: "arc",
        path: ["sheet", "stats", "arcane"]
      }
    ]);
  });
});
