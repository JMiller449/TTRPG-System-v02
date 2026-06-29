import { describe, expect, it } from "vitest";
import type { Augmentation, ItemBridge, ItemDefinition } from "@/domain/models";
import {
  countItemEffectTypes,
  itemCarryStatus,
  selectActiveEquipmentEffects,
  summarizeItemActionGrants
} from "@/features/sheets/equipmentDisplay";

const item: ItemDefinition = {
  id: "item_1",
  name: "Flame Helm",
  interaction_type: "equippable",
  description: "",
  price: "",
  weight: "",
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
});
