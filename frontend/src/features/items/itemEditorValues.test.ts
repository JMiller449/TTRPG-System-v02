import { describe, expect, it } from "vitest";
import type { ItemDefinition } from "@/domain/models";
import {
  createEmptyItemValues,
  getItemEditorValidationError,
  toItemDefinitionPayload,
  toItemEditorValues,
  toUpdatedItemDefinitionPayload
} from "@/features/items/itemEditorValues";

function testItem(overrides: Partial<ItemDefinition> = {}): ItemDefinition {
  return {
    id: "item_1",
    name: "Sword of Mana",
    interaction_type: "equippable",
    category: "Sword",
    rank: "S",
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
    values.description = " A blade that conducts mana. ";

    expect(toItemDefinitionPayload(values, "item_1")).toEqual({
      id: "item_1",
      name: "Sword of Mana",
      interaction_type: "equippable",
      category: "Sword",
      rank: "S",
      description: "A blade that conducts mana.",
      world_anvil_url: "https://worldanvil.example/items/sword-of-mana",
      gm_notes: "Award only after the mana trial.",
      gm_special_properties: "Adds +50 to sword enchantments.",
      price: "NA",
      weight: "3LBS",
      augmentation_templates: [],
      action_grants: []
    });
  });

  it("maps backend item definitions into editor values", () => {
    expect(toItemEditorValues(testItem())).toEqual({
      name: "Sword of Mana",
      interactionType: "equippable",
      type: "Sword",
      rank: "S",
      weight: "3LBS",
      value: "NA",
      worldAnvilUrl: "https://worldanvil.example/items/sword-of-mana",
      gmNotes: "Award only after the mana trial.",
      gmSpecialProperties: "Adds +50 to sword enchantments.",
      description: [
        "Immediate effect (legacy reference): 25% increased mana regen.",
        "Non-immediate effect (legacy reference): Conducts mana at 100% efficiency."
      ].join("\n"),
      augmentationTemplates: [],
      actionGrants: []
    });
  });

  it("uses first-class metadata with unlabeled legacy descriptions", () => {
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
      type: "Sword",
      rank: "S",
      description: "A plain text item description.",
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
    values.description = " Better enchantment channeling. ";

    expect(toUpdatedItemDefinitionPayload(item, values)).toEqual({
      ...item,
      name: "Edited Sword of Mana",
      category: "Sword",
      rank: "S+",
      description: "Better enchantment channeling.",
      world_anvil_url: "https://worldanvil.example/items/edited-sword",
      gm_notes: "Updated GM notes.",
      gm_special_properties: "Updated hidden property.",
      price: "1,000CP",
      weight: "4LBS",
      action_grants: []
    });
  });

  it("normalizes equippable action grants to equipped availability", () => {
    const values = createEmptyItemValues();
    values.name = "Potion";
    values.actionGrants = [
      { actionId: " drink_potion ", availability: "carried", consumeQuantity: "1" },
      { actionId: "sword_strike", availability: "equipped", consumeQuantity: "0" }
    ];

    expect(toItemDefinitionPayload(values, "potion").action_grants).toEqual([
      { action_id: "drink_potion", availability: "equipped", consume_quantity: 1 },
      { action_id: "sword_strike", availability: "equipped", consume_quantity: 0 }
    ]);
  });

  it("normalizes consumable actions and removes mechanics from inventory-only items", () => {
    const values = createEmptyItemValues();
    values.name = "Potion";
    values.interactionType = "consumable";
    values.actionGrants = [
      { actionId: "drink_potion", availability: "equipped", consumeQuantity: "1" }
    ];

    expect(toItemDefinitionPayload(values, "potion").action_grants).toEqual([
      { action_id: "drink_potion", availability: "carried", consume_quantity: 1 }
    ]);

    values.interactionType = "inventory_only";
    values.gmSpecialProperties = "Hidden mechanics";
    expect(toItemDefinitionPayload(values, "potion")).toMatchObject({
      augmentation_templates: [],
      action_grants: [],
      gm_special_properties: ""
    });
  });

  it("embeds create-time equipment effects with the final item source", () => {
    const values = createEmptyItemValues();
    values.name = "Flame Helm";
    values.augmentationTemplates = [
      {
        id: "augmentation_1",
        name: "Fire Focus",
        source: { type: "item", id: "draft-item" },
        scope: "instance",
        target: { root: "instance", path: ["stats", "arcane"] },
        effect: {
          type: "formula_modifier",
          operation: "add",
          value: { aliases: null, text: "2" }
        }
      }
    ];

    expect(toItemDefinitionPayload(values, "item_final").augmentation_templates).toEqual([
      expect.objectContaining({
        id: "augmentation_1",
        source: { type: "item", id: "item_final", label: "Flame Helm" },
        lifecycle_owner: "equipment",
        applied: false,
        applied_target_id: null
      })
    ]);
  });

  it("validates consumable use actions and duplicate grants", () => {
    const values = createEmptyItemValues();
    values.name = "Potion";
    values.interactionType = "consumable";
    expect(getItemEditorValidationError(values)).toContain("use action");

    values.actionGrants = [
      { actionId: "drink", availability: "carried", consumeQuantity: "1" },
      { actionId: "drink", availability: "carried", consumeQuantity: "1" }
    ];
    expect(getItemEditorValidationError(values)).toContain("only once");
  });
});
