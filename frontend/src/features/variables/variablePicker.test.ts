import { describe, expect, it } from "vitest";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import { filterSearchPopoverOptions } from "@/shared/ui/searchPopover";
import {
  buildVariablePickerEntries,
  filterVariablePickerEntries,
  formulaVariableSearchOptions,
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
      key: "template.stats.arcane",
      label: "Template Arcane",
      root: "template",
      path: ["stats", "arcane"],
      value_type: "number",
      editable_roles: [],
      formula_backed: false,
      description: "Parent-template value.",
      shortcuts: ["template_arc", "template_arcane"],
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
  formula_roots: ["sheet", "template", "instance"],
  action_mutation_roots: ["sheet", "instance"],
  formula_aliases: [],
  action_steps: [],
  action_preset_templates: [],
  action_attribute_presets: []
};

describe("variablePicker", () => {
  it("builds formula entries with tokens and alias paths", () => {
    const entries = buildVariablePickerEntries(metadata, "formula");
    const arcane = entries.find((entry) => entry.key === "sheet.stats.arcane");
    const templateArcane = entries.find(
      (entry) => entry.key === "template.stats.arcane"
    );

    expect(entries).toHaveLength(4);
    expect(arcane).toMatchObject({
      label: "Arcane",
      token: "@arc",
      alias: {
        name: "arc",
        path: ["sheet", "stats", "arcane"]
      }
    });
    expect(variablePathLabel(arcane!)).toBe("sheet.stats.arcane");
    expect(templateArcane).toMatchObject({
      label: "Template Arcane",
      token: "@template_arc",
      alias: {
        name: "template_arc",
        path: ["template", "stats", "arcane"]
      },
      actionMutationAllowed: false
    });
  });

  it("builds Action Attribute and explicit source-item formula roots", () => {
    const attributeMetadata: ActionFormulaAuthoringMetadata = {
      ...metadata,
      variables: [
        ...metadata.variables,
        {
          key: "sheet.attributes.level",
          label: "Character Attribute: Level",
          root: "sheet",
          path: ["attributes", "level"],
          value_type: "number",
          editable_roles: [],
          formula_backed: false,
          description: "Evaluated Attribute on the acting character instance.",
          shortcuts: ["sheet_attribute_level"],
          formula_reference_allowed: true,
          action_mutation_allowed: false
        },
        {
          key: "action.attributes.action_base_spell_damage",
          label: "Action: Base Spell Damage",
          root: "action",
          path: ["attributes", "action_base_spell_damage"],
          value_type: "number",
          editable_roles: [],
          formula_backed: false,
          description: "Evaluated Action Attribute.",
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
      formula_roots: ["sheet", "template", "instance", "action", "source_item"]
    };

    const entries = buildVariablePickerEntries(attributeMetadata, "formula");

    expect(
      entries.find((entry) => entry.key === "sheet.attributes.level")
    ).toMatchObject({
      token: "@sheet_attribute_level",
      alias: {
        name: "sheet_attribute_level",
        path: ["sheet", "attributes", "level"]
      },
      actionMutationAllowed: false
    });
    expect(
      entries.find((entry) => entry.key === "action.attributes.action_base_spell_damage")
        ?.alias
    ).toEqual({
      name: "base_spell_damage",
      path: ["action", "attributes", "action_base_spell_damage"]
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
      "sheet.stats.arcane",
      "template.stats.arcane"
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

  it("adds action-specific search terms without changing the backend alias", () => {
    const actionMetadata: ActionFormulaAuthoringMetadata = {
      ...metadata,
      variables: [
        ...metadata.variables,
        {
          key: "action.resolved.proficiency_modifier",
          label: "Action: Proficiency Modifier",
          root: "action",
          path: ["resolved", "proficiency_modifier"],
          value_type: "number",
          editable_roles: [],
          formula_backed: true,
          description: "Modifier selected by the Action Proficiency Attribute.",
          shortcuts: ["action_proficiency", "spell_proficiency"],
          formula_reference_allowed: true,
          action_mutation_allowed: false
        }
      ]
    };

    const option = formulaVariableSearchOptions(actionMetadata, undefined, {
      "action.resolved.proficiency_modifier": {
        keywords: ["mana_ball", "Mana Ball"],
        label: "Mana Ball Proficiency Modifier",
        detail: "Selected proficiency: Mana Ball"
      }
    }).find((entry) => entry.id === "action.resolved.proficiency_modifier");

    expect(option).toMatchObject({
      label: "Mana Ball Proficiency Modifier",
      secondary:
        "@action_proficiency | action.resolved.proficiency_modifier | number | Selected proficiency: Mana Ball",
      value: {
        token: "@action_proficiency",
        alias: {
          name: "action_proficiency",
          path: ["action", "resolved", "proficiency_modifier"]
        }
      }
    });
    expect(option?.keywords).toEqual(expect.arrayContaining(["mana_ball", "Mana Ball"]));
    expect(
      filterSearchPopoverOptions(
        formulaVariableSearchOptions(actionMetadata, undefined, {
          "action.resolved.proficiency_modifier": {
            keywords: ["mana_ball", "Mana Ball"]
          }
        }),
        "mana_ball"
      ).map((entry) => entry.id)
    ).toEqual(["action.resolved.proficiency_modifier"]);
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
