import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ItemDefinition } from "@/domain/models";
import { SheetEquipmentSection } from "@/features/sheets/components/SheetEquipmentSection";

const sword = {
  id: "sword",
  name: "Sword",
  interaction_type: "equippable",
  description: "",
  price: "",
  weight: 0,
  augmentation_templates: []
} as ItemDefinition;

describe("SheetEquipmentSection", () => {
  it("allows player equip toggles without inventory management controls", () => {
    const markup = renderToStaticMarkup(
      <SheetEquipmentSection
        items={{ sword }}
        actionDefinitions={{}}
        attributeDefinitions={{}}
        proficiencyDefinitions={{}}
        augmentations={{}}
        itemOrder={["sword"]}
        selectedItemId=""
        selectedItem={null}
        equipment={[
          {
            relationship_id: "main_hand",
            item_id: "sword",
            count: 1,
            equipped: false
          }
        ]}
        currentCarriedWeight={10}
        carryWeightLimit={10}
        canManageInventory={false}
        canToggleEquipped
        onSelectedItemIdChange={() => undefined}
        onAddSelectedItem={() => undefined}
        onQuantityChange={() => undefined}
        onToggleEquipped={() => undefined}
        onMoveInventoryItem={() => undefined}
        onRemoveInventoryItem={() => undefined}
      />
    );

    expect(markup).toContain('aria-label="Equip: Sword"');
    expect(markup).toContain("Carried Weight: 10 / 10 lb");
    expect(markup).not.toContain("over capacity");
    expect(markup).not.toContain("quantity value");
    expect(markup).not.toContain("Remove Sword from inventory");
  });

  it("shows over-capacity weight and contained items in read-only view", () => {
    const bag: ItemDefinition = {
      id: "bag",
      name: "Bag of Holding",
      interaction_type: "inventory_only",
      description: "",
      price: "",
      weight: 2,
      can_contain_items: true,
      contents_weight_behavior: "ignored"
    };
    const markup = renderToStaticMarkup(
      <SheetEquipmentSection
        items={{ sword, bag }}
        actionDefinitions={{}}
        attributeDefinitions={{}}
        proficiencyDefinitions={{}}
        augmentations={{}}
        itemOrder={["bag", "sword"]}
        selectedItemId=""
        selectedItem={null}
        equipment={[
          { relationship_id: "bag-entry", item_id: "bag", count: 1, equipped: false },
          {
            relationship_id: "sword-entry",
            item_id: "sword",
            count: 1,
            equipped: false,
            parent_container_id: "bag-entry"
          }
        ]}
        currentCarriedWeight={12.5}
        carryWeightLimit={10}
        canManageInventory={false}
        canToggleEquipped={false}
        onSelectedItemIdChange={() => undefined}
        onAddSelectedItem={() => undefined}
        onQuantityChange={() => undefined}
        onToggleEquipped={() => undefined}
        onMoveInventoryItem={() => undefined}
        onRemoveInventoryItem={() => undefined}
      />
    );

    expect(markup).toContain("Carried Weight: 12.5 / 10 lb");
    expect(markup).toContain("2.5 lb over capacity");
    expect(markup).toContain("Stored in Bag of Holding");
    expect(markup).toContain("Contents weight ignored");
  });
});
