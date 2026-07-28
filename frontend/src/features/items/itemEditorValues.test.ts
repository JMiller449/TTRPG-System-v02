import { describe, expect, it } from "vitest";
import type { AttributeDefinition, ItemDefinition } from "@/domain/models";
import {
  createEmptyItemValues,
  createItemValuesFromTemplate,
  getItemEditorValidationError,
  toItemDefinitionPayload,
  toItemEditorValues,
  toUpdatedItemDefinitionPayload
} from "@/features/items/itemEditorValues";

const weaponAttributes: Record<string, AttributeDefinition> = {
  weapon_base_damage: {
    id: "weapon_base_damage",
    name: "Base Damage",
    subject_types: ["item"],
    value_type: "number",
    default_value: { type: "number", value: 0 },
    required: false
  },
  weapon_governing_stat: {
    id: "weapon_governing_stat",
    name: "Governing Stat",
    subject_types: ["item"],
    value_type: "enum",
    default_value: { type: "enum", value: "strength" },
    required: false
  },
  weapon_reach: {
    id: "weapon_reach",
    name: "Reach",
    subject_types: ["item"],
    value_type: "number",
    default_value: { type: "number", value: 0 },
    required: false
  },
  weapon_proficiency: {
    id: "weapon_proficiency",
    name: "Proficiency",
    subject_types: ["item"],
    value_type: "reference",
    default_value: { type: "reference", value: "" },
    reference_kind: "proficiency",
    required: false
  }
};

function testItem(overrides: Partial<ItemDefinition> = {}): ItemDefinition {
  return {
    id: "item_1",
    name: "Sword of Mana",
    interaction_type: "equippable",
    rank: "S",
    description: "A blade that conducts mana.",
    world_anvil_url: "https://worldanvil.example/items/sword-of-mana",
    gm_notes: "Award only after the mana trial.",
    gm_special_properties: "Adds +50 to sword enchantments.",
    price: "NA",
    weight: 3,
    tags: [],
    attributes: {},
    augmentation_templates: [],
    ...overrides
  };
}

describe("itemEditorValues", () => {
  it("maps item editor values to backend item definitions", () => {
    const values = createEmptyItemValues();
    values.name = "  Sword of Mana  ";
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
      rank: "S",
      description: "A blade that conducts mana.",
      world_anvil_url: "https://worldanvil.example/items/sword-of-mana",
      gm_notes: "Award only after the mana trial.",
      gm_special_properties: "Adds +50 to sword enchantments.",
      price: "NA",
      weight: 3,
      player_catalog_access: {
        mode: "none",
        instance_ids: []
      },
      can_contain_items: false,
      storage_capacity_weight: null,
      contents_weight_behavior: "normal",
      tags: [],
      attributes: {},
      augmentation_templates: [],
      action_grants: []
    });
  });

  it("maps selected player catalog access to stable instance IDs", () => {
    const values = createEmptyItemValues();
    values.name = "Hero Reward";
    values.playerCatalogAccess = {
      mode: "selected",
      instanceIds: ["hero-instance", "rival-instance"]
    };

    expect(toItemDefinitionPayload(values, "hero_reward").player_catalog_access).toEqual({
      mode: "selected",
      instance_ids: ["hero-instance", "rival-instance"]
    });
  });

  it("maps backend item definitions into editor values", () => {
    expect(toItemEditorValues(testItem())).toEqual({
      name: "Sword of Mana",
      interactionType: "equippable",
      rank: "S",
      weight: "3",
      canContainItems: false,
      storageCapacityWeight: "",
      contentsWeightBehavior: "normal",
      value: "NA",
      worldAnvilUrl: "https://worldanvil.example/items/sword-of-mana",
      gmNotes: "Award only after the mana trial.",
      gmSpecialProperties: "Adds +50 to sword enchantments.",
      playerCatalogAccess: {
        mode: "all",
        instanceIds: []
      },
      description: "A blade that conducts mana.",
      tags: [],
      attributes: {},
      augmentationTemplates: [],
      actionGrants: []
    });
  });

  it("copies template defaults into an independent private item draft", () => {
    const template = testItem({
      tags: ["weapon"],
      player_catalog_access: { mode: "all", instanceIds: [] },
      attributes: {
        weapon_base_damage: {
          relationship_id: "template_damage",
          attribute_id: "weapon_base_damage",
          value: { type: "number", value: 12 }
        }
      },
      augmentation_templates: [
        {
          id: "template_effect",
          name: "Template Effect",
          source: { type: "item", id: "template" },
          scope: "instance",
          target: { root: "instance", path: ["mana"] },
          effect: {
            type: "formula_modifier",
            operation: "add",
            value: { aliases: null, text: "1" }
          }
        }
      ]
    });

    const draft = createItemValuesFromTemplate(template);

    expect(draft.playerCatalogAccess).toEqual({ mode: "none", instanceIds: [] });
    expect(draft.tags).toEqual(["weapon"]);
    expect(draft.attributes.weapon_base_damage.relationship_id).not.toBe("template_damage");
    expect(draft.augmentationTemplates[0]?.id).not.toBe("template_effect");
    draft.attributes.weapon_base_damage.value = { type: "number", value: 20 };
    expect(template.attributes?.weapon_base_damage.value).toEqual({
      type: "number",
      value: 12
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
      rank: "S+",
      description: "Better enchantment channeling.",
      world_anvil_url: "https://worldanvil.example/items/edited-sword",
      gm_notes: "Updated GM notes.",
      gm_special_properties: "Updated hidden property.",
      price: "1,000CP",
      weight: 4,
      player_catalog_access: {
        mode: "none",
        instance_ids: []
      },
      can_contain_items: false,
      storage_capacity_weight: null,
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

  it("validates ordinary item Attributes and managed tag IDs without applying a profile", () => {
    const values = createEmptyItemValues();
    values.name = "Never Dulls";
    values.tags = ["weapon", "long_sword", "slashing"];
    values.attributes.weapon_base_damage = {
      relationship_id: "item_attribute_damage",
      attribute_id: "weapon_base_damage",
      value: { type: "number", value: 15 },
      evaluated_value: null,
      evaluation_error: null
    };
    values.attributes.weapon_proficiency = {
      relationship_id: "item_attribute_proficiency",
      attribute_id: "weapon_proficiency",
      value: { type: "reference", value: "missing_proficiency" },
      evaluated_value: null,
      evaluation_error: null
    };
    expect(
      getItemEditorValidationError(values, { definitions: weaponAttributes })
    ).toContain("missing proficiency ID");

    values.attributes.weapon_proficiency.value = { type: "reference", value: "long_swords" };
    expect(
      getItemEditorValidationError(values, {
        definitions: weaponAttributes,
        proficiencies: {
          long_swords: {
            id: "long_swords",
            name: "Long Swords",
            description: "",
            default_growth_rate: 0.01
          }
        }
      })
    ).toBeNull();
    expect(toItemDefinitionPayload(values, "sword")).toMatchObject({
      tags: ["weapon", "long_sword", "slashing"],
      action_grants: [],
      attributes: {
        weapon_base_damage: { value: { type: "number", value: 15 } },
        weapon_proficiency: {
          value: { type: "reference", value: "long_swords" }
        }
      }
    });
  });

  it("maps and validates storage capacity and carried-weight negation", () => {
    const values = createEmptyItemValues();
    values.name = "Bag of Holding";
    values.canContainItems = true;
    values.storageCapacityWeight = " 500 ";
    values.contentsWeightBehavior = "ignored";

    expect(getItemEditorValidationError(values)).toBeNull();
    expect(toItemDefinitionPayload(values, "holding_bag")).toMatchObject({
      can_contain_items: true,
      storage_capacity_weight: 500,
      contents_weight_behavior: "ignored"
    });

    values.storageCapacityWeight = "-1";
    expect(getItemEditorValidationError(values)).toContain(
      "finite nonnegative number"
    );
  });
});
