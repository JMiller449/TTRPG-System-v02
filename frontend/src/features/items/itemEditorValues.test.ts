import { describe, expect, it } from "vitest";
import type { AttributeDefinition, ItemDefinition } from "@/domain/models";
import {
  createEmptyItemValues,
  getItemEditorValidationError,
  setItemAttributeProfile,
  toItemDefinitionPayload,
  toItemEditorValues,
  toUpdatedItemDefinitionPayload
} from "@/features/items/itemEditorValues";

const weaponAttributes: Record<string, AttributeDefinition> = {
  weapon_type: {
    id: "weapon_type",
    name: "Weapon Type",
    subject_types: ["item"],
    value_type: "text",
    default_value: { type: "text", value: "" },
    required: true,
    required_profile: "weapon"
  },
  weapon_base_damage: {
    id: "weapon_base_damage",
    name: "Base Damage",
    subject_types: ["item"],
    value_type: "number",
    default_value: { type: "number", value: 0 },
    required: true,
    required_profile: "weapon"
  },
  weapon_governing_stat: {
    id: "weapon_governing_stat",
    name: "Governing Stat",
    subject_types: ["item"],
    value_type: "enum",
    default_value: { type: "enum", value: "strength" },
    required: true,
    required_profile: "weapon"
  },
  weapon_damage_types: {
    id: "weapon_damage_types",
    name: "Physical Damage Types",
    subject_types: ["item"],
    value_type: "list",
    default_value: { type: "list", value: [] },
    required: true,
    required_profile: "weapon"
  },
  weapon_reach: {
    id: "weapon_reach",
    name: "Reach",
    subject_types: ["item"],
    value_type: "number",
    default_value: { type: "number", value: 0 },
    required: true,
    required_profile: "weapon"
  },
  weapon_proficiency: {
    id: "weapon_proficiency",
    name: "Proficiency",
    subject_types: ["item"],
    value_type: "reference",
    default_value: { type: "reference", value: "" },
    reference_kind: "proficiency",
    required: true,
    required_profile: "weapon"
  },
  weapon_proficiency_growth_rate: {
    id: "weapon_proficiency_growth_rate",
    name: "Proficiency Growth Rate",
    subject_types: ["item"],
    value_type: "number",
    default_value: { type: "number", value: 0 },
    required: true,
    required_profile: "weapon"
  }
};

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

describe("itemEditorValues", () => {
  it("maps item editor values to backend item definitions", () => {
    const values = createEmptyItemValues();
    values.name = "  Sword of Mana  ";
    values.type = " Sword ";
    values.rank = "S";
    values.weight = " 3 ";
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
      weight: 3,
      player_visible: false,
      can_contain_items: false,
      contents_weight_behavior: "normal",
      attribute_profile: null,
      attributes: {},
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
      weight: "3",
      canContainItems: false,
      contentsWeightBehavior: "normal",
      value: "NA",
      worldAnvilUrl: "https://worldanvil.example/items/sword-of-mana",
      gmNotes: "Award only after the mana trial.",
      gmSpecialProperties: "Adds +50 to sword enchantments.",
      playerVisible: true,
      description: "A blade that conducts mana.",
      attributeProfile: null,
      attributes: {},
      augmentationTemplates: [],
      actionGrants: []
    });
  });

  it("uses first-class metadata and optional field defaults", () => {
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
    values.weight = " 4 ";
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
      weight: 4,
      player_visible: false,
      can_contain_items: false,
      contents_weight_behavior: "normal",
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

  it("attaches and validates backend-declared weapon profile Attributes", () => {
    let values = createEmptyItemValues();
    values.name = "Never Dulls";
    values = setItemAttributeProfile(values, "weapon", weaponAttributes);

    expect(values.interactionType).toBe("equippable");
    expect(Object.keys(values.attributes)).toEqual(Object.keys(weaponAttributes));
    expect(values.actionGrants.map((grant) => grant.actionId)).toEqual([
      "weapon_attack",
      "weapon_damage",
      "weapon_parry",
      "weapon_contest"
    ]);
    expect(getItemEditorValidationError(values, { definitions: weaponAttributes })).toContain(
      "Weapon Type"
    );

    values.attributes.weapon_type.value = { type: "text", value: "Long Sword" };
    values.attributes.weapon_damage_types.value = { type: "list", value: ["Slashing"] };
    values.attributes.weapon_proficiency.value = {
      type: "reference",
      value: "long_swords"
    };
    expect(
      getItemEditorValidationError(values, {
        definitions: weaponAttributes,
        proficiencies: {
          long_swords: { id: "long_swords", name: "Long Swords", description: "" }
        }
      })
    ).toBeNull();
    expect(toItemDefinitionPayload(values, "sword")).toMatchObject({
      attribute_profile: "weapon",
      action_grants: [
        { action_id: "weapon_attack", availability: "equipped", consume_quantity: 0 },
        { action_id: "weapon_damage", availability: "equipped", consume_quantity: 0 },
        { action_id: "weapon_parry", availability: "equipped", consume_quantity: 0 },
        { action_id: "weapon_contest", availability: "equipped", consume_quantity: 0 }
      ],
      attributes: {
        weapon_type: { value: { type: "text", value: "Long Sword" } },
        weapon_proficiency: {
          value: { type: "reference", value: "long_swords" }
        }
      }
    });
  });
});
