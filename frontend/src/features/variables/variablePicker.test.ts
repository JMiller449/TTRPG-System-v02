import { describe, expect, it } from "vitest";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import {
  appendFormulaToken,
  buildVariablePickerEntries,
  filterVariablePickerEntries,
  toVariableSearchOptions,
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
  action_preset_templates: [],
  action_fact_presets: []
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

  it("builds Action Fact and explicit source-item formula roots", () => {
    const factMetadata: ActionFormulaAuthoringMetadata = {
      ...metadata,
      variables: [
        ...metadata.variables,
        {
          key: "action.facts.action_base_spell_damage",
          label: "Action: Base Spell Damage",
          root: "action",
          path: ["facts", "action_base_spell_damage"],
          value_type: "number",
          editable_roles: [],
          formula_backed: false,
          description: "Evaluated Action Fact.",
          shortcuts: ["base_spell_damage"],
          formula_reference_allowed: true,
          action_mutation_allowed: false
        },
        {
          key: "source_item.resolved.governing_stat",
          label: "Source Weapon: Governing Stat Value",
          root: "source_item",
          path: ["resolved", "governing_stat"],
          value_type: "number",
          editable_roles: [],
          formula_backed: true,
          description: "Resolved source weapon value.",
          shortcuts: ["weapon_stat"],
          formula_reference_allowed: true,
          action_mutation_allowed: false
        }
      ],
      formula_roots: ["sheet", "instance", "action", "source_item"]
    };

    const entries = buildVariablePickerEntries(factMetadata, "formula");

    expect(
      entries.find((entry) => entry.key === "action.facts.action_base_spell_damage")
        ?.alias
    ).toEqual({
      name: "base_spell_damage",
      path: ["action", "facts", "action_base_spell_damage"]
    });
    expect(
      entries.find((entry) => entry.key === "source_item.resolved.governing_stat")
        ?.alias
    ).toEqual({
      name: "weapon_stat",
      path: ["source_item", "resolved", "governing_stat"]
    });
  });

  it("filters mutation entries to backend-approved mutation paths", () => {
    const entries = buildVariablePickerEntries(metadata, "mutation");

    expect(entries.map((entry) => entry.key)).toEqual(["instance.mana", "sheet.stats.arcane"]);
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

  it("adapts variable metadata into compact generic search options", () => {
    const entries = buildVariablePickerEntries(metadata, "formula");
    const arcane = toVariableSearchOptions(entries).find(
      (option) => option.id === "sheet.stats.arcane"
    );

    expect(arcane).toMatchObject({
      label: "Arcane",
      secondary: "@arc | sheet.stats.arcane | number",
      value: {
        key: "sheet.stats.arcane",
        token: "@arc"
      }
    });
    expect(arcane?.keywords).toContain("Base sheet stat.");
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
