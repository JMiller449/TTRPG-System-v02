import { describe, expect, it } from "vitest";
import type { Sheet } from "@/domain/models";
import {
  createDefaultStats,
  createEmptyTemplateEditorValues,
  toInstancedSheetCreationValues,
  toSheetDefinitionPayload,
  toTemplateEditorValues,
  toUpdatedSheetDefinitionPayload,
  validateTemplateEditorValues,
  type TemplateReferenceCatalogs
} from "@/features/sheets/templateEditorValues";

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
      weight: "2"
    }
  }
};

function completeSheet(): Sheet {
  return {
    id: "template_1",
    name: "Mage",
    notes: "Backend template notes",
    dm_only: false,
    xp_given_when_slayed: 25,
    xp_cap: "100",
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
      ...createDefaultStats(),
      strength: 4,
      arcane: 6,
      health: {
        aliases: [{ name: "constitution", path: ["stats", "constitution"] }],
        text: "@constitution * 10",
        tags: ["health"]
      }
    },
    resistances: { resistance: 0.1, fire: 0.25 },
    slayed_record: { enemy_1: { sheet_id: "enemy_1", count: 1 } },
    actions: {
      action_bridge_1: {
        relationship_id: "action_bridge_1",
        entry_id: "action_1"
      }
    }
  };
}

describe("templateEditorValues", () => {
  it("maps a complete template draft to one backend sheet definition", () => {
    const values = createEmptyTemplateEditorValues("enemy");
    values.name = "  Ember Guard  ";
    values.notes = "  GM-facing notes  ";
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

    expect(validateTemplateEditorValues(values, catalogs).isValid).toBe(true);
    expect(toSheetDefinitionPayload(values, "template_1")).toMatchObject({
      id: "template_1",
      name: "Ember Guard",
      notes: "GM-facing notes",
      dm_only: true,
      xp_given_when_slayed: 25,
      xp_cap: "100",
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
      }
    });
  });

  it("hydrates every editable section from an authoritative sheet", () => {
    const values = toTemplateEditorValues(completeSheet());

    expect(values).toMatchObject({
      kind: "player",
      notes: "Backend template notes",
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
      items: [
        { relationshipId: "item_bridge_1", itemId: "item_1", count: "2", equipped: true }
      ]
    });
    expect(values.formulaStats.health.text).toBe("@constitution * 10");
    expect(values.slayedRecord).toEqual({ enemy_1: { sheet_id: "enemy_1", count: 1 } });
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
    expect(payload.slayed_record).toEqual(sheet.slayed_record);
  });

  it("reports invalid fields, duplicate references, and impossible equipment state by section", () => {
    const values = createEmptyTemplateEditorValues();
    values.coreStats.strength = "";
    values.resistances.fire = "101";
    values.actions = [
      { relationshipId: "a1", actionId: "action_1" },
      { relationshipId: "a2", actionId: "action_1" }
    ];
    values.items = [
      { relationshipId: "i1", itemId: "item_1", count: "0", equipped: true }
    ];

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

  it("maps player templates to instanced sheet creation values with access codes", () => {
    const sheet = completeSheet();
    sheet.stats.health = { aliases: null, text: "32.5" };
    sheet.stats.mana = { aliases: null, text: "12" };

    expect(toInstancedSheetCreationValues(sheet, "player", "instance_1")).toEqual({
      instanceId: "instance_1",
      parentSheetId: "template_1",
      health: 32.5,
      mana: 12,
      notes: "",
      generateAccessCode: true
    });
  });

  it("falls back to core stats for nonnumeric spawn resource formulas", () => {
    const sheet = completeSheet();
    sheet.stats.constitution = 9;
    sheet.stats.arcane = 5.8;
    sheet.stats.health = { aliases: null, text: "constitution * 10" };
    sheet.stats.mana = { aliases: null, text: "arcane * 2" };

    expect(toInstancedSheetCreationValues(sheet, "enemy", "instance_1")).toEqual({
      instanceId: "instance_1",
      parentSheetId: "template_1",
      health: 9,
      mana: 5,
      notes: "",
      generateAccessCode: false
    });
  });
});
