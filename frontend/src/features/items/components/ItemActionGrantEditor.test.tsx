import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ItemActionGrantEditor } from "@/features/items/components/ItemActionGrantEditor";
import { createEmptyItemValues } from "@/features/items/itemEditorValues";

describe("ItemActionGrantEditor", () => {
  it("offers backend-seeded weapon actions to equippable items", () => {
    const values = createEmptyItemValues();
    values.interactionType = "equippable";
    values.actionGrants = [
      {
        actionId: "",
        availability: "equipped",
        consumeQuantity: "0"
      }
    ];
    const markup = renderToStaticMarkup(
      <ItemActionGrantEditor
        values={values}
        actions={[
          { id: "weapon_attack", name: "Weapon Attack" },
          { id: "weapon_damage", name: "Weapon Damage" },
          { id: "weapon_parry", name: "Weapon Parry" },
          { id: "weapon_contest", name: "Weapon Contest" }
        ]}
        onChange={() => undefined}
        onOpenActionAuthoring={() => undefined}
      />
    );

    expect(markup).toContain("Equipped Actions");
    expect(markup).toContain('value="weapon_attack"');
    expect(markup).toContain("Weapon Damage");
    expect(markup).toContain("Weapon Parry");
    expect(markup).toContain("Weapon Contest");
  });
});
