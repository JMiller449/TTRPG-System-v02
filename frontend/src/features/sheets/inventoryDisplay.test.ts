import { describe, expect, it } from "vitest";
import type { ItemBridge, ItemDefinition } from "@/domain/models";
import {
  buildInventoryTree,
  eligibleContainerDestinations,
  formatWeight
} from "@/features/sheets/inventoryDisplay";

const items: Record<string, ItemDefinition> = {
  bag: {
    id: "bag",
    name: "Bag of Holding",
    interaction_type: "inventory_only",
    description: "",
    price: "",
    weight: 2,
    can_contain_items: true,
    contents_weight_behavior: "ignored"
  },
  pouch: {
    id: "pouch",
    name: "Pouch",
    interaction_type: "inventory_only",
    description: "",
    price: "",
    weight: 0.5,
    can_contain_items: true,
    contents_weight_behavior: "normal"
  },
  sword: {
    id: "sword",
    name: "Sword",
    interaction_type: "equippable",
    description: "",
    price: "",
    weight: 3
  }
};

const entries: ItemBridge[] = [
  { relationship_id: "bag", item_id: "bag", count: 1, equipped: false },
  {
    relationship_id: "pouch",
    item_id: "pouch",
    count: 1,
    equipped: false,
    parent_container_id: "bag"
  },
  {
    relationship_id: "sword",
    item_id: "sword",
    count: 1,
    equipped: false,
    parent_container_id: "pouch"
  }
];

describe("inventoryDisplay", () => {
  it("orders contained entries beneath their parents", () => {
    expect(
      buildInventoryTree(entries).map(({ bridge, depth }) => [bridge.relationship_id, depth])
    ).toEqual([
      ["bag", 0],
      ["pouch", 1],
      ["sword", 2]
    ]);
  });

  it("excludes the moving entry and descendants from destinations", () => {
    expect(
      eligibleContainerDestinations("bag", entries, items).map((entry) => entry.relationship_id)
    ).toEqual([]);
    expect(
      eligibleContainerDestinations("sword", entries, items).map((entry) => entry.relationship_id)
    ).toEqual(["bag", "pouch"]);
  });

  it("formats weights without floating point noise", () => {
    expect(formatWeight(3)).toBe("3");
    expect(formatWeight(3.125)).toBe("3.125");
  });
});
