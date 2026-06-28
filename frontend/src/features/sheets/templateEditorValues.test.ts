import { describe, expect, it } from "vitest";
import type { Sheet } from "@/domain/models";
import {
  createDefaultStats,
  createEmptyTemplateEditorValues,
  toInstancedSheetCreationValues,
  toSheetDefinitionPayload,
  toTemplateEditorValues,
  toUpdatedSheetDefinitionPayload
} from "@/features/sheets/templateEditorValues";

describe("templateEditorValues", () => {
  it("maps template editor values to backend sheet definitions", () => {
    const values = createEmptyTemplateEditorValues("enemy");
    values.name = "  Ember Guard  ";
    values.notes = "  GM-facing notes  ";
    values.xpGivenWhenSlayed = "25";
    values.xpCap = " 100 ";
    values.coreStats.strength = "12";
    values.coreStats.arcane = "8";
    values.coreStats.will = "not-a-number";

    expect(toSheetDefinitionPayload(values, "template_1")).toEqual({
      id: "template_1",
      name: "Ember Guard",
      notes: "GM-facing notes",
      dm_only: true,
      xp_given_when_slayed: 25,
      xp_cap: "100",
      proficiencies: {},
      items: {},
      stats: {
        ...createDefaultStats(),
        strength: 12,
        arcane: 8
      },
      slayed_record: {},
      actions: {}
    });
  });

  it("uses backend sheet notes when presentation notes are absent", () => {
    const sheet: Sheet = {
      id: "template_1",
      name: "Mage",
      notes: "Backend template notes",
      dm_only: false,
      xp_given_when_slayed: 0,
      xp_cap: "",
      proficiencies: {},
      items: {},
      stats: createDefaultStats(),
      slayed_record: {},
      actions: {}
    };

    expect(toTemplateEditorValues(sheet)).toMatchObject({
      notes: "Backend template notes",
      xpGivenWhenSlayed: "",
      xpCap: ""
    });
  });

  it("maps template edits to full backend sheet definitions without dropping existing records", () => {
    const sheet: Sheet = {
      id: "template_1",
      name: "Mage",
      notes: "Old notes",
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
          active: true
        }
      },
      stats: {
        ...createDefaultStats(),
        strength: 4,
        arcane: 6,
        health: { aliases: null, text: "constitution * 10" }
      },
      slayed_record: {
        enemy_1: {
          sheet_id: "enemy_1",
          count: 1
        }
      },
      actions: {
        action_bridge_1: {
          relationship_id: "action_bridge_1",
          entry_id: "action_1"
        }
      }
    };
    const values = createEmptyTemplateEditorValues("enemy");
    values.name = "  Edited Mage  ";
    values.notes = "  Updated notes  ";
    values.xpGivenWhenSlayed = "50";
    values.xpCap = "200";
    values.coreStats.strength = "10";
    values.coreStats.arcane = "";

    expect(toUpdatedSheetDefinitionPayload(sheet, values)).toEqual({
      ...sheet,
      name: "Edited Mage",
      notes: "Updated notes",
      dm_only: true,
      xp_given_when_slayed: 50,
      xp_cap: "200",
      stats: {
        ...sheet.stats,
        strength: 10
      }
    });
  });

  it("maps player templates to instanced sheet creation values with access codes", () => {
    const sheet: Sheet = {
      id: "template_1",
      name: "Mage",
      dm_only: false,
      xp_given_when_slayed: 0,
      xp_cap: "",
      proficiencies: {},
      items: {},
      stats: {
        ...createDefaultStats(),
        constitution: 7,
        arcane: 4,
        health: { aliases: null, text: "32.5" },
        mana: { aliases: null, text: "12" }
      },
      slayed_record: {},
      actions: {}
    };

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
    const sheet: Sheet = {
      id: "template_1",
      name: "Enemy",
      dm_only: true,
      xp_given_when_slayed: 0,
      xp_cap: "",
      proficiencies: {},
      items: {},
      stats: {
        ...createDefaultStats(),
        constitution: 9,
        arcane: 5.8,
        health: { aliases: null, text: "constitution * 10" },
        mana: { aliases: null, text: "arcane * 2" }
      },
      slayed_record: {},
      actions: {}
    };

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
