import { describe, expect, it } from "vitest";
import type { ItemDefinition } from "@/domain/models";
import {
  createEmptyItemValues,
  toItemDefinitionPayload,
  toItemEditorValues,
  toUpdatedItemDefinitionPayload
} from "@/features/items/itemEditorValues";

function testItem(overrides: Partial<ItemDefinition> = {}): ItemDefinition {
  return {
    id: "item_1",
    name: "Sword of Mana",
    description: [
      "Type: Sword",
      "Rank: S",
      "Immediate Effects: 25% increased mana regen.",
      "Non-Immediate Effects: Conducts mana at 100% efficiency."
    ].join("\n"),
    world_anvil_url: "https://worldanvil.example/items/sword-of-mana",
    gm_notes: "Award only after the mana trial.",
    gm_special_properties: "Adds +50 to sword enchantments.",
    price: "NA",
    weight: "3LBS",
    augmentation_templates: [],
    ...overrides
  };
}

describe("itemEditorValues", () => {
  it("maps item editor values to backend item definitions", () => {
    const values = createEmptyItemValues();
    values.name = "  Sword of Mana  ";
    values.type = " Sword ";
    values.rank = "S";
    values.weight = " 3LBS ";
    values.value = " NA ";
    values.worldAnvilUrl = " https://worldanvil.example/items/sword-of-mana ";
    values.gmNotes = " Award only after the mana trial. ";
    values.gmSpecialProperties = " Adds +50 to sword enchantments. ";
    values.immediateEffects = " 25% increased mana regen. ";
    values.nonImmediateEffects = " Conducts mana at 100% efficiency. ";

    expect(toItemDefinitionPayload(values, "item_1")).toEqual({
      id: "item_1",
      name: "Sword of Mana",
      description: [
        "Type: Sword",
        "Rank: S",
        "Immediate Effects: 25% increased mana regen.",
        "Non-Immediate Effects: Conducts mana at 100% efficiency."
      ].join("\n"),
      world_anvil_url: "https://worldanvil.example/items/sword-of-mana",
      gm_notes: "Award only after the mana trial.",
      gm_special_properties: "Adds +50 to sword enchantments.",
      price: "NA",
      weight: "3LBS",
      augmentation_templates: []
    });
  });

  it("maps backend item definitions into editor values", () => {
    expect(toItemEditorValues(testItem())).toEqual({
      name: "Sword of Mana",
      type: "Sword",
      rank: "S",
      weight: "3LBS",
      value: "NA",
      worldAnvilUrl: "https://worldanvil.example/items/sword-of-mana",
      gmNotes: "Award only after the mana trial.",
      gmSpecialProperties: "Adds +50 to sword enchantments.",
      immediateEffects: "25% increased mana regen.",
      nonImmediateEffects: "Conducts mana at 100% efficiency."
    });
  });

  it("uses unlabeled backend descriptions as immediate effects for legacy readability", () => {
    expect(
      toItemEditorValues(
        testItem({
          description: "A plain text item description.",
          world_anvil_url: undefined,
          gm_notes: undefined,
          gm_special_properties: undefined
        })
      )
    ).toMatchObject({
      type: "",
      rank: "F",
      immediateEffects: "A plain text item description.",
      nonImmediateEffects: "",
      worldAnvilUrl: "",
      gmNotes: "",
      gmSpecialProperties: ""
    });
  });

  it("maps item edits to full backend item definitions without dropping existing records", () => {
    const item = testItem();
    const values = createEmptyItemValues();
    values.name = "  Edited Sword of Mana  ";
    values.type = " Sword ";
    values.rank = "S+";
    values.weight = " 4LBS ";
    values.value = " 1,000CP ";
    values.worldAnvilUrl = " https://worldanvil.example/items/edited-sword ";
    values.gmNotes = " Updated GM notes. ";
    values.gmSpecialProperties = " Updated hidden property. ";
    values.immediateEffects = " +30% mana regen. ";
    values.nonImmediateEffects = " Better enchantment channeling. ";

    expect(toUpdatedItemDefinitionPayload(item, values)).toEqual({
      ...item,
      name: "Edited Sword of Mana",
      description: [
        "Type: Sword",
        "Rank: S+",
        "Immediate Effects: +30% mana regen.",
        "Non-Immediate Effects: Better enchantment channeling."
      ].join("\n"),
      world_anvil_url: "https://worldanvil.example/items/edited-sword",
      gm_notes: "Updated GM notes.",
      gm_special_properties: "Updated hidden property.",
      price: "1,000CP",
      weight: "4LBS"
    });
  });
});
