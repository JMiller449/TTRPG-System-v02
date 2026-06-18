import { describe, expect, it } from "vitest";
import {
  buildAdjustInstancedSheetResourceRequest,
  buildClaimSheetAccessCodeRequest,
  buildCreateInstancedSheetRequest,
  buildCreateItemRequest,
  buildCreateSheetRequest,
  buildCreateSheetItemBridgeRequest,
  buildDeleteItemRequest,
  buildDeleteSheetRequest,
  buildDeleteSheetItemBridgeRequest,
  buildSetInstancedSheetResourceRequest,
  buildSetSheetBaseStatRequest,
  buildUpdateItemRequest,
  buildUpdateSheetItemBridgeRequest,
  buildUpdateSheetRequest,
  type ItemDefinitionPayload,
  type SheetDefinitionPayload
} from "@/infrastructure/ws/requestBuilders";

const testFormula = { aliases: null, text: "0" };

const testItem: ItemDefinitionPayload = {
  id: "item_1",
  name: "Sword of Mana",
  description: "Rank S Sword\nImmediate Effects: 25% increased mana regen.",
  world_anvil_url: "https://worldanvil.example/items/sword-of-mana",
  gm_notes: "Award only after the mana trial.",
  gm_special_properties: "Conducts mana at 100% efficiency.",
  price: "NA",
  weight: "3LBS",
  stat_augmentations: [],
  augmentation_templates: []
};

const testSheet: SheetDefinitionPayload = {
  id: "sheet_1",
  name: "Mage",
  notes: "GM-only template notes",
  dm_only: false,
  xp_given_when_slayed: 0,
  xp_cap: "",
  proficiencies: {},
  items: {},
  stats: {
    strength: 1,
    dexterity: 2,
    constitution: 3,
    perception: 4,
    arcane: 5,
    will: 6,
    lifting: testFormula,
    carry_weight: testFormula,
    acrobatics: testFormula,
    stamina: testFormula,
    reaction_time: testFormula,
    health: { aliases: null, text: "30" },
    endurance: testFormula,
    pain_tolerance: testFormula,
    sight_distance: testFormula,
    intuition: testFormula,
    registration: testFormula,
    mana: { aliases: null, text: "12" },
    control: testFormula,
    sensitivity: testFormula,
    charisma: testFormula,
    mental_fortitude: testFormula,
    courage: testFormula
  },
  slayed_record: {},
  actions: {}
};

describe("requestBuilders", () => {
  it("builds sheet access code claim requests", () => {
    expect(buildClaimSheetAccessCodeRequest({ code: "MAGE2026" })).toEqual({
      type: "claim_sheet_access_code",
      code: "MAGE2026"
    });
  });

  it("builds current resource set requests with optional request ids", () => {
    expect(
      buildSetInstancedSheetResourceRequest({
        requestId: "req-resource-set",
        instanceId: "instance_1",
        resource: "health",
        value: 32
      })
    ).toEqual({
      request_id: "req-resource-set",
      type: "set_instanced_sheet_resource",
      instance_id: "instance_1",
      resource: "health",
      value: 32
    });
  });

  it("builds current resource adjustment requests", () => {
    expect(
      buildAdjustInstancedSheetResourceRequest({
        instanceId: "instance_1",
        resource: "mana",
        delta: -5
      })
    ).toEqual({
      type: "adjust_instanced_sheet_resource",
      instance_id: "instance_1",
      resource: "mana",
      delta: -5
    });
  });

  it("builds base stat update requests", () => {
    expect(
      buildSetSheetBaseStatRequest({
        sheetId: "sheet_1",
        statName: "strength",
        value: 14
      })
    ).toEqual({
      type: "set_sheet_base_stat",
      sheet_id: "sheet_1",
      stat_name: "strength",
      value: 14
    });
  });

  it("builds sheet item bridge create requests", () => {
    expect(
      buildCreateSheetItemBridgeRequest({
        sheetId: "sheet_1",
        bridge: {
          relationship_id: "item_bridge_1",
          item_id: "item_1",
          count: 1,
          active: true
        }
      })
    ).toEqual({
      type: "create_sheet_item_bridge",
      sheet_id: "sheet_1",
      bridge: {
        relationship_id: "item_bridge_1",
        item_id: "item_1",
        count: 1,
        active: true
      }
    });
  });

  it("builds sheet item bridge update requests", () => {
    expect(
      buildUpdateSheetItemBridgeRequest({
        sheetId: "sheet_1",
        relationshipId: "item_bridge_1",
        bridge: {
          relationship_id: "item_bridge_1",
          item_id: "item_1",
          count: 2,
          active: false
        }
      })
    ).toEqual({
      type: "update_sheet_item_bridge",
      sheet_id: "sheet_1",
      relationship_id: "item_bridge_1",
      bridge: {
        relationship_id: "item_bridge_1",
        item_id: "item_1",
        count: 2,
        active: false
      }
    });
  });

  it("builds sheet item bridge delete requests", () => {
    expect(
      buildDeleteSheetItemBridgeRequest({
        sheetId: "sheet_1",
        relationshipId: "item_bridge_1"
      })
    ).toEqual({
      type: "delete_sheet_item_bridge",
      sheet_id: "sheet_1",
      relationship_id: "item_bridge_1"
    });
  });

  it("builds sheet create requests", () => {
    expect(buildCreateSheetRequest({ sheet: testSheet })).toEqual({
      type: "create_sheet",
      sheet: testSheet
    });
  });

  it("builds sheet update requests", () => {
    expect(
      buildUpdateSheetRequest({
        requestId: "req-sheet-update",
        sheetId: "sheet_1",
        sheet: {
          ...testSheet,
          name: "Edited Mage"
        }
      })
    ).toEqual({
      request_id: "req-sheet-update",
      type: "update_sheet",
      sheet_id: "sheet_1",
      sheet: {
        ...testSheet,
        name: "Edited Mage"
      }
    });
  });

  it("builds sheet delete requests", () => {
    expect(buildDeleteSheetRequest({ sheetId: "sheet_1" })).toEqual({
      type: "delete_sheet",
      sheet_id: "sheet_1"
    });
  });

  it("builds instanced sheet create requests", () => {
    expect(
      buildCreateInstancedSheetRequest({
        instanceId: "instance_1",
        parentSheetId: "sheet_1",
        health: 30,
        mana: 12,
        notes: "",
        generateAccessCode: true
      })
    ).toEqual({
      type: "create_instanced_sheet",
      instance_id: "instance_1",
      parent_sheet_id: "sheet_1",
      health: 30,
      mana: 12,
      notes: "",
      generate_access_code: true
    });
  });

  it("builds item create requests", () => {
    expect(buildCreateItemRequest({ item: testItem })).toEqual({
      type: "create_item",
      item: testItem
    });
  });

  it("builds item update requests", () => {
    expect(
      buildUpdateItemRequest({
        requestId: "req-item-update",
        itemId: "item_1",
        item: {
          ...testItem,
          name: "Edited Sword of Mana"
        }
      })
    ).toEqual({
      request_id: "req-item-update",
      type: "update_item",
      item_id: "item_1",
      item: {
        ...testItem,
        name: "Edited Sword of Mana"
      }
    });
  });

  it("builds item delete requests", () => {
    expect(buildDeleteItemRequest({ itemId: "item_1" })).toEqual({
      type: "delete_item",
      item_id: "item_1"
    });
  });
});
