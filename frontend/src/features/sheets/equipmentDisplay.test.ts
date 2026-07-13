import { describe, expect, it } from "vitest";
import type {
  AttributeDefinition,
  Augmentation,
  ItemBridge,
  ItemDefinition
} from "@/domain/models";
import {
  countItemEffectTypes,
  itemCarryStatus,
  selectActiveEquipmentEffects,
  summarizeKeyItemAttributes,
  summarizeItemActionGrants
} from "@/features/sheets/equipmentDisplay";

const item: ItemDefinition = {
  id: "item_1",
  name: "Flame Helm",
  interaction_type: "equippable",
  description: "",
  price: "",
  weight: 0,
  action_grants: [
    { action_id: "flare", availability: "equipped", consume_quantity: 0 },
    { action_id: "throw", availability: "carried", consume_quantity: 2 }
  ],
  augmentation_templates: [
    {
      id: "direct",
      name: "Fire Sight",
      source: { type: "item" },
      scope: "instance",
      target: { root: "instance", path: ["stats", "perception"] },
      effect: {
        type: "formula_modifier",
        operation: "add",
        value: { aliases: null, text: "2" }
      }
    },
    {
      id: "roll",
      name: "Fire Focus",
      source: { type: "item" },
      scope: "instance",
      target: { root: "instance", path: ["stats", "perception"] },
      effect: { type: "roll_mode_modifier", roll_mode: "advantage" }
    }
  ]
};

const bridge: ItemBridge = {
  relationship_id: "bridge_1",
  item_id: "item_1",
  count: 1,
  equipped: false
};

const weaponAttributeDefinitions: Record<string, AttributeDefinition> = {
  weapon_proficiency: {
    id: "weapon_proficiency",
    name: "Weapon Proficiency",
    subject_types: ["item"],
    value_type: "reference",
    default_value: { type: "reference", value: "" },
    reference_kind: "proficiency"
  },
  weapon_proficiency_growth_rate: {
    id: "weapon_proficiency_growth_rate",
    name: "Weapon Proficiency Growth Rate",
    subject_types: ["item"],
    value_type: "number",
    default_value: { type: "number", value: 0 }
  },
  weapon_reach: {
    id: "weapon_reach",
    name: "Weapon Reach",
    subject_types: ["item"],
    value_type: "number",
    default_value: { type: "number", value: 0 }
  }
};

describe("equipmentDisplay", () => {
  it("derives carried, equipped, and depleted states from the authoritative bridge", () => {
    expect(itemCarryStatus(item, bridge)).toBe("Carried");
    expect(itemCarryStatus(item, { ...bridge, equipped: true })).toBe("Equipped");
    expect(itemCarryStatus(item, { ...bridge, count: 0, equipped: false })).toBe("Depleted");
  });

  it("projects action availability without retaining local eligibility state", () => {
    expect(
      summarizeItemActionGrants(item, bridge, {
        flare: { id: "flare", name: "Flare" },
        throw: { id: "throw", name: "Throw Helm" }
      })
    ).toEqual([
      {
        actionId: "flare",
        actionName: "Flare",
        availability: "Equipped",
        consumeQuantity: 0,
        available: false,
        status: "Requires equipped item"
      },
      {
        actionId: "throw",
        actionName: "Throw Helm",
        availability: "Carried",
        consumeQuantity: 2,
        available: false,
        status: "Needs 2 in inventory"
      }
    ]);
  });

  it("selects only concrete active effects owned by one equipment relationship", () => {
    const active = {
      ...item.augmentation_templates?.[0],
      id: "concrete",
      source: { type: "item" as const, relationship_id: "bridge_1" },
      lifecycle_owner: "equipment" as const,
      active: true,
      applied: true
    } as Augmentation;
    const inactive = { ...active, id: "inactive", applied: false };
    const other = {
      ...active,
      id: "other",
      source: { type: "item", relationship_id: "bridge_2" }
    } as Augmentation;

    expect(
      selectActiveEquipmentEffects({ concrete: active, inactive, other }, "bridge_1").map(
        (augmentation) => augmentation.id
      )
    ).toEqual(["concrete"]);
    expect(countItemEffectTypes(item)).toEqual({ wearer: 1, rollOrFormula: 1 });
  });

  it("summarizes the key item attributes for inventory hover details", () => {
    expect(
      summarizeKeyItemAttributes(
        {
          ...item,
          attributes: {
            weapon_proficiency: {
              relationship_id: "item_attr_prof",
              attribute_id: "weapon_proficiency",
              value: { type: "reference", value: "longsword" }
            },
            weapon_proficiency_growth_rate: {
              relationship_id: "item_attr_growth",
              attribute_id: "weapon_proficiency_growth_rate",
              value: { type: "number", value: 0.5 }
            },
            weapon_reach: {
              relationship_id: "item_attr_reach",
              attribute_id: "weapon_reach",
              value: { type: "number", value: 5 }
            }
          }
        },
        weaponAttributeDefinitions,
        {
          longsword: {
            id: "longsword",
            name: "Longsword",
            description: "Bladed weapon family"
          }
        }
      )
    ).toEqual(["Proficiency: Longsword", "Growth: 0.5", "Reach: 5"]);
  });
});
