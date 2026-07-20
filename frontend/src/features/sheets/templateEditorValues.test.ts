import { describe, expect, it } from "vitest";
import type { AttributeDefinition, Sheet } from "@/domain/models";
import { FORMULA_STAT_KEYS } from "@/features/sheets/sheetDefinitionEditing";
import {
  createDefaultStats,
  createEmptyTemplateEditorValues,
  toInstancedSheetCreationValues,
  toSheetDefinitionPayload,
  toTemplateEditorValues,
  toUpdatedSheetDefinitionPayload,
  validateTemplateEditorValues,
  type SheetFormulaStatDefaults,
  type TemplateReferenceCatalogs
} from "@/features/sheets/templateEditorValues";

const formulaDefaults: SheetFormulaStatDefaults = FORMULA_STAT_KEYS.map((statName) => ({
  stat_name: statName,
  formula: {
    aliases: [{ name: "strength", path: ["stats", "strength"] }],
    text: `@strength + ${FORMULA_STAT_KEYS.indexOf(statName)}`,
    tags: []
  }
}));

const catalogs: TemplateReferenceCatalogs = {
  actions: {
    action_1: { id: "action_1", name: "Attack", roll_mode_kind: "check", steps: [] }
  },
  proficiencies: {
    prof_1: { id: "prof_1", name: "Longsword", description: "Sword use" }
  },
  items: {
    item_1: {
      id: "item_1",
      name: "Iron Helm",
      interaction_type: "equippable",
      description: "",
      price: "10",
      weight: 2
    }
  },
  attributes: {
    level: {
      id: "level",
      name: "Level",
      description: "Character level.",
      subject_types: ["sheet"],
      value_type: "number",
      default_value: { type: "number", value: 1 },
      required: false
    },
    item_only_attribute: {
      id: "item_only_attribute",
      name: "Item Only",
      description: "",
      subject_types: ["item"],
      value_type: "text",
      default_value: { type: "text", value: "" },
      required: false
    }
  }
};

const sheetAttributes: Record<string, AttributeDefinition> = {
  amount_of_reactions: {
    id: "amount_of_reactions",
    name: "Amount of Reactions",
    subject_types: ["sheet"],
    value_type: "number",
    default_value: {
      type: "formula",
      formula: {
        aliases: [
          { name: "registration", path: ["stats", "registration"] },
          { name: "reaction_time", path: ["stats", "reaction_time"] }
        ],
        text: "@registration + @reaction_time"
      }
    },
    required: true
  }
};

function completeSheet(): Sheet {
  return {
    id: "template_1",
    name: "Mage",
    notes: "Backend template notes",
    profile: {
      species: "Elf",
      background: "Scholar",
      alignment: "",
      pronouns: "they/them",
      age: "120",
      height: "6 ft",
      weight: "170 lb",
      eyes: "Green",
      skin: "Bronze",
      hair: "Black",
      appearance: "Ink-stained hands.",
      personality_traits: "Curious",
      ideals: "Knowledge",
      bonds: "The academy",
      flaws: "Reckless curiosity",
      allies_and_organizations: "The old library",
      backstory: "A traveling researcher."
    },
    dm_only: false,
    xp_given_when_slayed: 25,
    xp_cap: 100,
    proficiencies: {
      prof_bridge_1: {
        relationship_id: "prof_bridge_1",
        prof_id: "prof_1",
        use_count: 3,
        growth_rate: 2
      }
    },
    items: {
      item_bridge_1: {
        relationship_id: "item_bridge_1",
        item_id: "item_1",
        count: 2,
        equipped: true
      }
    },
    stats: {
      ...createDefaultStats(formulaDefaults),
      strength: 4,
      arcane: 6,
      health: {
        aliases: [{ name: "constitution", path: ["stats", "constitution"] }],
        text: "@constitution * 10",
        tags: ["health"]
      }
    },
    resistances: { resistance: 0.1, fire: 0.25 },
    actions: {
      action_bridge_1: {
        relationship_id: "action_bridge_1",
        entry_id: "action_1"
      }
    },
    attributes: {
      level: {
        relationship_id: "sheet_attribute_level",
        attribute_id: "level",
        value: { type: "number", value: 3 },
        evaluated_value: 3,
        evaluation_error: null
      }
    }
  };
}

describe("templateEditorValues", () => {
  it("builds new-template substats from backend-provided formula metadata", () => {
    const stats = createDefaultStats(formulaDefaults);

    for (const key of FORMULA_STAT_KEYS) {
      const expected = formulaDefaults.find((entry) => entry.stat_name === key)?.formula;
      expect(stats[key]).toEqual(expected);
      expect(stats[key]).not.toBe(expected);
    }
  });

  it("does not invent fallback rules when backend formula metadata is incomplete", () => {
    const values = createEmptyTemplateEditorValues(
      "player",
      {},
      formulaDefaults.filter((entry) => entry.stat_name !== "courage")
    );
    values.name = "Incomplete Defaults";

    expect(values.formulaStats.courage).toEqual({ aliases: null, text: "", tags: [] });
    expect(validateTemplateEditorValues(values, catalogs).errors.stats).toContain(
      "Every formula stat needs a formula and valid variable aliases."
    );
  });

  it("maps a complete template draft to one backend sheet definition", () => {
    const values = createEmptyTemplateEditorValues("enemy", {}, formulaDefaults);
    values.name = "  Ember Guard  ";
    values.racialHpMultiplier = "50";
    values.notes = "  GM-facing notes  ";
    values.profile.species = "  Fire Genasi  ";
    values.profile.height = "  6 ft 2 in  ";
    values.profile.weight = "  190 lb  ";
    values.profile.backstory = "  Raised near the caldera.  ";
    values.xpGivenWhenSlayed = "25";
    values.xpCap = " 100 ";
    values.coreStats.strength = "12";
    values.coreStats.arcane = "8";
    values.formulaStats.health = {
      aliases: [{ name: "constitution", path: ["stats", "constitution"] }],
      text: " @constitution * 10 ",
      tags: [" Health ", "health"]
    };
    values.resistances.fire = "25";
    values.actions = [{ relationshipId: "action_bridge_1", actionId: "action_1" }];
    values.proficiencies = [
      {
        relationshipId: "prof_bridge_1",
        proficiencyId: "prof_1",
        useCount: "3",
        growthRate: "2"
      }
    ];
    values.items = [
      { relationshipId: "item_bridge_1", itemId: "item_1", count: "2", equipped: true }
    ];
    values.attributes = {
      level: {
        relationship_id: "sheet_attribute_level",
        attribute_id: "level",
        value: { type: "number", value: 4 },
        evaluated_value: null,
        evaluation_error: null
      }
    };

    expect(validateTemplateEditorValues(values, catalogs).isValid).toBe(true);
    expect(toSheetDefinitionPayload(values, "template_1")).toMatchObject({
      id: "template_1",
      name: "Ember Guard",
      notes: "GM-facing notes",
      profile: {
        species: "Fire Genasi",
        height: "6 ft 2 in",
        weight: "190 lb",
        backstory: "Raised near the caldera."
      },
      dm_only: true,
      xp_given_when_slayed: 25,
      xp_cap: 100,
      racial_hp_multiplier: 50,
      max_health: { text: "floor(@health * @racial_hp_multiplier)" },
      max_mana: { text: "floor(@arcane * @mana)" },
      stats: {
        strength: 12,
        arcane: 8,
        health: {
          aliases: [{ name: "constitution", path: ["stats", "constitution"] }],
          text: "@constitution * 10",
          tags: ["health"]
        }
      },
      resistances: { fire: 0.25 },
      actions: {
        action_bridge_1: { relationship_id: "action_bridge_1", entry_id: "action_1" }
      },
      proficiencies: {
        prof_bridge_1: {
          relationship_id: "prof_bridge_1",
          prof_id: "prof_1",
          use_count: 3,
          growth_rate: 2
        }
      },
      items: {
        item_bridge_1: {
          relationship_id: "item_bridge_1",
          item_id: "item_1",
          count: 2,
          equipped: true
        }
      },
      attributes: {
        level: {
          relationship_id: "sheet_attribute_level",
          attribute_id: "level",
          value: { type: "number", value: 4 },
          evaluated_value: null,
          evaluation_error: null
        }
      }
    });
  });

  it("seeds required Attributes and includes them in the atomic sheet payload", () => {
    const values = createEmptyTemplateEditorValues("player", sheetAttributes, formulaDefaults);
    values.name = "Reactive Guard";
    values.racialHpMultiplier = "50";
    const validation = validateTemplateEditorValues(values, {
      ...catalogs,
      attributes: sheetAttributes
    });
    const payload = toSheetDefinitionPayload(values, "reactive_guard");

    expect(validation.isValid).toBe(true);
    expect(values.attributes.amount_of_reactions.relationship_id).toBe(
      "required_attribute_amount_of_reactions"
    );
    expect(payload.attributes?.amount_of_reactions).toMatchObject({
      relationship_id: "required_attribute_amount_of_reactions",
      attribute_id: "amount_of_reactions",
      value: sheetAttributes.amount_of_reactions.default_value,
      evaluated_value: null,
      evaluation_error: null
    });
  });

  it("rejects a template draft missing a required sheet Attribute", () => {
    const values = createEmptyTemplateEditorValues("player", sheetAttributes, formulaDefaults);
    values.name = "Invalid Guard";
    delete values.attributes.amount_of_reactions;

    const validation = validateTemplateEditorValues(values, {
      ...catalogs,
      attributes: sheetAttributes
    });

    expect(validation.errors.attributes).toContain(
      "Every required sheet Attribute must remain attached."
    );
  });

  it("hydrates every editable section from an authoritative sheet", () => {
    const values = toTemplateEditorValues(completeSheet());

    expect(values).toMatchObject({
      kind: "player",
      notes: "Backend template notes",
      profile: {
        species: "Elf",
        height: "6 ft",
        weight: "170 lb",
        backstory: "A traveling researcher."
      },
      xpGivenWhenSlayed: "25",
      xpCap: "100",
      coreStats: { strength: "4", arcane: "6" },
      resistances: { resistance: "10", fire: "25" },
      actions: [{ relationshipId: "action_bridge_1", actionId: "action_1" }],
      proficiencies: [
        {
          relationshipId: "prof_bridge_1",
          proficiencyId: "prof_1",
          useCount: "3",
          growthRate: "2"
        }
      ],
      items: [{ relationshipId: "item_bridge_1", itemId: "item_1", count: "2", equipped: true }],
      attributes: {
        level: {
          relationship_id: "sheet_attribute_level",
          attribute_id: "level",
          value: { type: "number", value: 3 },
          evaluated_value: 3,
          evaluation_error: null
        }
      }
    });
    expect(values.formulaStats.health.text).toBe("@constitution * 10");
  });

  it("preserves stable bridge IDs and hidden slay records during a complete edit", () => {
    const sheet = completeSheet();
    const values = toTemplateEditorValues(sheet);
    values.kind = "enemy";
    values.name = "  Edited Mage  ";
    values.coreStats.strength = "10";

    const payload = toUpdatedSheetDefinitionPayload(sheet, values);

    expect(payload.id).toBe(sheet.id);
    expect(payload.name).toBe("Edited Mage");
    expect(payload.dm_only).toBe(true);
    expect(payload.stats.strength).toBe(10);
    expect(payload.stats.health).toEqual(sheet.stats.health);
    expect(payload.actions).toEqual(sheet.actions);
    expect(payload.proficiencies).toEqual(sheet.proficiencies);
    expect(payload.items).toEqual(sheet.items);
    expect(payload.attributes).toEqual({
      level: {
        relationship_id: "sheet_attribute_level",
        attribute_id: "level",
        value: { type: "number", value: 3 },
        evaluated_value: null,
        evaluation_error: null
      }
    });
  });

  it("rejects missing or non-sheet Attribute assignments", () => {
    const values = createEmptyTemplateEditorValues();
    values.name = "Attribute Draft";
    values.attributes = {
      item_only_attribute: {
        relationship_id: "sheet_attribute_item_only",
        attribute_id: "item_only_attribute",
        value: { type: "text", value: "invalid" },
        evaluated_value: null,
        evaluation_error: null
      }
    };

    const validation = validateTemplateEditorValues(values, catalogs);

    expect(validation.isValid).toBe(false);
    expect(validation.errors.attributes).toContain(
      "Every attached Attribute must support sheets and reference an available definition."
    );
  });

  it("reports invalid fields, duplicate references, and impossible equipment state by section", () => {
    const values = createEmptyTemplateEditorValues("player", {}, formulaDefaults);
    values.coreStats.strength = "";
    values.resistances.fire = "101";
    values.actions = [
      { relationshipId: "a1", actionId: "action_1" },
      { relationshipId: "a2", actionId: "action_1" }
    ];
    values.items = [{ relationshipId: "i1", itemId: "item_1", count: "0", equipped: true }];

    const validation = validateTemplateEditorValues(values, catalogs);

    expect(validation.isValid).toBe(false);
    expect(validation.errors.details).toContain("Template name is required.");
    expect(validation.errors.stats).toHaveLength(1);
    expect(validation.errors.resistances).toHaveLength(1);
    expect(validation.errors.actions).toContain("An action can only be assigned once.");
    expect(validation.errors.inventory).toContain(
      "Only positive-quantity equippable items can start equipped."
    );
  });

  it("leaves default player instance resources for the backend to evaluate", () => {
    const sheet = completeSheet();
    sheet.stats.health = { aliases: null, text: "32.5" };
    sheet.stats.mana = { aliases: null, text: "12" };

    expect(toInstancedSheetCreationValues(sheet, "player", "instance_1")).toEqual({
      instanceId: "instance_1",
      parentSheetId: "template_1",
      notes: "",
      generateAccessCode: true
    });
  });

  it("leaves default enemy instance resources for the backend to evaluate", () => {
    const sheet = completeSheet();
    sheet.stats.constitution = 9;
    sheet.stats.arcane = 5.8;
    sheet.stats.health = { aliases: null, text: "constitution * 10" };
    sheet.stats.mana = { aliases: null, text: "arcane * 2" };

    expect(toInstancedSheetCreationValues(sheet, "enemy", "instance_1")).toEqual({
      instanceId: "instance_1",
      parentSheetId: "template_1",
      notes: "",
      generateAccessCode: false
    });
  });
});
