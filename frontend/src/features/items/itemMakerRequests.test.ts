import { describe, expect, it } from "vitest";
import type { ItemDefinition } from "@/domain/models";
import { createEmptyItemValues } from "@/features/items/itemEditorValues";
import {
  buildCreateItemSubmission,
  buildDeleteItemSubmission,
  buildUpdateItemSubmission,
  selectOrderedItemDefinitions
} from "@/features/items/itemMakerRequests";

function testItem(overrides: Partial<ItemDefinition> = {}): ItemDefinition {
  return {
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
    weight: 3,
    attribute_profile: null,
    attributes: {},
    augmentation_templates: [],
    ...overrides
  };
}

describe("itemMakerRequests", () => {
  it("selects authoritative item definitions in server item order", () => {
    const sword = testItem({ id: "item_sword", name: "Sword" });
    const shield = testItem({ id: "item_shield", name: "Shield" });

    expect(
      selectOrderedItemDefinitions(
        {
          item_sword: sword,
          item_shield: shield
        },
        ["item_shield", "missing_item", "item_sword"]
      )
    ).toEqual([shield, sword]);
  });

  it("builds create submissions from editor values", () => {
    const values = createEmptyItemValues();
    values.name = "  Sword of Mana  ";
    values.type = " Sword ";
    values.catalogFolder = " Weapons ";
    values.rank = "S";
    values.weight = " 3 ";
    values.value = " NA ";
    values.worldAnvilUrl = " https://worldanvil.example/items/sword-of-mana ";
    values.gmNotes = " Award only after the mana trial. ";
    values.gmSpecialProperties = " Adds +50 to sword enchantments. ";
    values.description = " A blade that conducts mana. ";

    expect(buildCreateItemSubmission(values, "item_created")).toEqual({
      request: {
        type: "create_item",
        item: {
          id: "item_created",
          name: "Sword of Mana",
          interaction_type: "equippable",
          category: "Sword",
          catalog_folder: "Weapons",
          rank: "S",
          description: "A blade that conducts mana.",
          world_anvil_url: "https://worldanvil.example/items/sword-of-mana",
          gm_notes: "Award only after the mana trial.",
          gm_special_properties: "Adds +50 to sword enchantments.",
          price: "NA",
          weight: 3,
          player_visible: false,
          can_contain_items: false,
          contents_weight_behavior: "normal",
          attribute_profile: null,
          attributes: {},
          augmentation_templates: [],
          action_grants: []
        }
      },
      label: "Create item: Sword of Mana"
    });
  });

  it("does not build create or update submissions for blank names", () => {
    const values = createEmptyItemValues();
    values.name = "   ";

    expect(buildCreateItemSubmission(values, "item_created")).toBeNull();
    expect(buildUpdateItemSubmission(testItem(), values)).toBeNull();
  });

  it("builds update submissions without dropping existing backend-only records", () => {
    const item = testItem();
    const values = createEmptyItemValues();
    values.name = "  Edited Sword of Mana  ";
    values.type = " Sword ";
    values.catalogFolder = " Weapons ";
    values.rank = "S+";
    values.weight = " 4 ";
    values.value = " 1,000CP ";
    values.worldAnvilUrl = " https://worldanvil.example/items/edited-sword ";
    values.gmNotes = " Updated GM notes. ";
    values.gmSpecialProperties = " Updated hidden property. ";
    values.description = " Better enchantment channeling. ";

    expect(buildUpdateItemSubmission(item, values)).toEqual({
      request: {
        type: "update_item",
        item_id: "item_1",
        item: {
          ...item,
          name: "Edited Sword of Mana",
          category: "Sword",
          catalog_folder: "Weapons",
          rank: "S+",
          description: "Better enchantment channeling.",
          world_anvil_url: "https://worldanvil.example/items/edited-sword",
          gm_notes: "Updated GM notes.",
          gm_special_properties: "Updated hidden property.",
          price: "1,000CP",
          weight: 4,
          player_visible: false,
          can_contain_items: false,
          contents_weight_behavior: "normal",
          action_grants: []
        }
      },
      label: "Update item: Edited Sword of Mana"
    });
  });

  it("does not build update submissions without a selected item", () => {
    const values = createEmptyItemValues();
    values.name = "Sword of Mana";

    expect(buildUpdateItemSubmission(undefined, values)).toBeNull();
  });

  it("builds delete submissions with item labels and a missing-item fallback", () => {
    expect(buildDeleteItemSubmission("item_1", testItem())).toEqual({
      request: {
        type: "delete_item",
        item_id: "item_1"
      },
      label: "Delete item: Sword of Mana"
    });

    expect(buildDeleteItemSubmission("item_missing", undefined)).toEqual({
      request: {
        type: "delete_item",
        item_id: "item_missing"
      },
      label: "Delete item: item"
    });
  });
});
