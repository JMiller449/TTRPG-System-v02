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
  weight: "",
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
        canManageInventory={false}
        canToggleEquipped
        onSelectedItemIdChange={() => undefined}
        onAddSelectedItem={() => undefined}
        onQuantityChange={() => undefined}
        onToggleEquipped={() => undefined}
        onRemoveInventoryItem={() => undefined}
      />
    );

    expect(markup).toContain('aria-label="Equip: Sword"');
    expect(markup).not.toContain("quantity value");
    expect(markup).not.toContain("Remove Sword from inventory");
  });
});
