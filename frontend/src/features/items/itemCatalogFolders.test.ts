import { describe, expect, it } from "vitest";
import type { ItemDefinition } from "@/domain/models";
import {
  filterItemCatalogItems,
  selectItemCatalogFolders
} from "@/features/items/itemCatalogFolders";

function item(id: string, name: string, catalogFolder: string, category = ""): ItemDefinition {
  return {
    id,
    name,
    interaction_type: "inventory_only",
    category,
    catalog_folder: catalogFolder,
    description: "",
    price: "",
    weight: 0
  };
}

const items = [
  item("sword", "Sun Blade", "Weapons", "Sword"),
  item("shield", "Moon Guard", "Weapons", "Shield"),
  item("potion", "Red Tonic", "Consumables", "Potion"),
  item("coin", "Old Coin", "")
];

describe("item catalog folders", () => {
  it("derives sorted named folders with counts and leaves unfiled separate", () => {
    expect(selectItemCatalogFolders(items)).toEqual([
      { name: "Consumables", count: 1 },
      { name: "Weapons", count: 2 }
    ]);
  });

  it("filters by named or unfiled folder without changing authoritative item order", () => {
    expect(filterItemCatalogItems(items, "Weapons", "").map((entry) => entry.id)).toEqual([
      "sword",
      "shield"
    ]);
    expect(filterItemCatalogItems(items, "", "").map((entry) => entry.id)).toEqual(["coin"]);
  });

  it("searches names, IDs, categories, ranks, and folders within the selected folder", () => {
    expect(filterItemCatalogItems(items, null, "red potion").map((entry) => entry.id)).toEqual([
      "potion"
    ]);
    expect(filterItemCatalogItems(items, "Weapons", "moon shield")).toEqual([items[1]]);
    expect(filterItemCatalogItems(items, "Consumables", "blade")).toEqual([]);
  });
});
