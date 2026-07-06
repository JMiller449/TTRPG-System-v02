import { describe, expect, it } from "vitest";
import { buildEquipmentQuantitySubmission } from "@/features/sheets/equipmentQuantity";

const bridge = {
  relationship_id: "main_hand",
  item_id: "sword",
  count: 3,
  equipped: true
};

describe("equipment quantity submissions", () => {
  it("unequips an item when its quantity reaches zero", () => {
    expect(
      buildEquipmentQuantitySubmission({
        instanceId: "instance_1",
        bridge,
        count: 0,
        itemName: "Sword"
      })
    ).toEqual({
      request: {
        type: "update_instanced_sheet_item_bridge",
        instance_id: "instance_1",
        relationship_id: "main_hand",
        bridge: {
          relationship_id: "main_hand",
          item_id: "sword",
          count: 0,
          equipped: false
        }
      },
      label: "Update quantity: Sword"
    });
  });

  it.each([-1, 1.5, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid count %s",
    (count) => {
      expect(
        buildEquipmentQuantitySubmission({
          instanceId: "instance_1",
          bridge,
          count,
          itemName: "Sword"
        })
      ).toBeNull();
    }
  );
});
