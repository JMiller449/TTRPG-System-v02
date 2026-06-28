import { describe, expect, it } from "vitest";
import {
  protocolRouteContracts,
  type ProtocolApplicationRequest
} from "@/generated/backendProtocol";
import {
  buildAuthenticateRequest,
  buildApplyInstancedSheetDamageRequest,
  buildCreateActionRequest,
  buildCreateConditionPresetRequest,
  buildCreateFormulaRequest,
  buildAdjustInstancedSheetResourceRequest,
  buildClaimSheetAccessCodeRequest,
  buildCreateInstancedSheetRequest,
  buildCreateItemRequest,
  buildCreateProficiencyRequest,
  buildCreateSheetRequest,
  buildCreateSheetActionBridgeRequest,
  buildCreateSheetItemBridgeRequest,
  buildCreateSheetProficiencyBridgeRequest,
  buildDeleteActionRequest,
  buildDeleteConditionPresetRequest,
  buildDeleteEncounterPresetRequest,
  buildDeleteFormulaRequest,
  buildDeleteItemRequest,
  buildDeleteProficiencyRequest,
  buildExportStateBackupRequest,
  buildRemoveItemAugmentationTemplateRequest,
  buildGetActionFormulaAuthoringMetadataRequest,
  buildGetAugmentationTargetMetadataRequest,
  buildGetRoll20BridgeStatusRequest,
  buildGetSheetAccessCodesRequest,
  buildGetVariableRegistryRequest,
  buildGetXpTrackerRequest,
  buildImportStateBackupRequest,
  buildSaveEncounterPresetRequest,
  buildDeleteSheetRequest,
  buildDeleteSheetActionBridgeRequest,
  buildDeleteSheetItemBridgeRequest,
  buildDeleteSheetProficiencyBridgeRequest,
  buildPerformActionRequest,
  buildGenerateSheetAccessCodeRequest,
  buildResyncStateRequest,
  buildSendRoll20ChatMessageRequest,
  buildSetInstancedSheetNotesRequest,
  buildSetInstancedSheetResourceRequest,
  buildSetSheetBaseStatRequest,
  buildSetSheetFormulaStatRequest,
  buildSetSheetResistancesRequest,
  buildSetSheetNotesRequest,
  buildSetMobXpValueRequest,
  buildSetSheetMobKillCountRequest,
  buildSetSheetXpRequiredRequest,
  buildSetSheetSlayedCountRequest,
  buildSpawnEncounterPresetRequest,
  buildUndoLastStateChangeRequest,
  buildUpdateActionRequest,
  buildUpdateConditionPresetRequest,
  buildUpdateFormulaRequest,
  buildUpdateItemRequest,
  buildUpdateProficiencyRequest,
  buildUpdateSheetActionBridgeRequest,
  buildUpdateSheetItemBridgeRequest,
  buildUpdateSheetProficiencyBridgeRequest,
  buildUpdateSheetRequest,
  buildUpsertItemAugmentationTemplateRequest,
  type AugmentationPayload,
  type ActionDefinitionPayload,
  type FormulaDefinitionPayload,
  type ItemDefinitionPayload,
  type ProficiencyDefinitionPayload,
  type EncounterPresetPayload,
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
  augmentation_templates: []
};

const testProficiency: ProficiencyDefinitionPayload = {
  id: "longsword",
  name: "Longsword",
  description: "Tracks approved longsword use."
};

const testAugmentation: AugmentationPayload = {
  id: "aug_1",
  name: "Arcane Guard",
  description: "Adds arcane defense while equipped.",
  source: {
    type: "item",
    id: "item_1",
    label: "Sword of Mana"
  },
  scope: "instance",
  target: {
    root: "instance",
    path: ["resistances", "arcane", "resistance"]
  },
  effect: {
    operation: "add",
    value: {
      aliases: null,
      text: "2"
    },
    type: "formula_modifier"
  },
  active: true,
  applied: false,
  applied_target_id: null,
  lifecycle: {
    duration: null,
    expires_at: null,
    removal_condition: null
  }
};

const testFormulaDefinition: FormulaDefinitionPayload = {
  id: "formula_1",
  formula: {
    aliases: [
      {
        name: "arcane",
        path: ["sheet", "stats", "arcane"]
      }
    ],
    text: "@arcane * 8"
  }
};

const testAction: ActionDefinitionPayload = {
  id: "action_1",
  name: "Mana Burst",
  notes: "Roll20 output only.",
  steps: [
    {
      step_id: "step_1",
      type: "send_message",
      message: {
        aliases: null,
        text: "/em releases a mana burst."
      }
    }
  ]
};

const testEncounter: EncounterPresetPayload = {
  id: "encounter_1",
  name: "Two Mages",
  entries: [
    {
      template_id: "sheet_1",
      count: 2
    }
  ],
  updated_at: "2026-06-19T00:00:00+00:00"
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

const requestBuilderByType = {
  adjust_instanced_sheet_resource: buildAdjustInstancedSheetResourceRequest,
  apply_instanced_sheet_damage: buildApplyInstancedSheetDamageRequest,
  authenticate: buildAuthenticateRequest,
  claim_sheet_access_code: buildClaimSheetAccessCodeRequest,
  create_action: buildCreateActionRequest,
  create_condition_preset: buildCreateConditionPresetRequest,
  create_formula: buildCreateFormulaRequest,
  create_instanced_sheet: buildCreateInstancedSheetRequest,
  create_item: buildCreateItemRequest,
  create_proficiency: buildCreateProficiencyRequest,
  create_sheet: buildCreateSheetRequest,
  create_sheet_action_bridge: buildCreateSheetActionBridgeRequest,
  create_sheet_item_bridge: buildCreateSheetItemBridgeRequest,
  create_sheet_proficiency_bridge: buildCreateSheetProficiencyBridgeRequest,
  delete_action: buildDeleteActionRequest,
  delete_condition_preset: buildDeleteConditionPresetRequest,
  delete_encounter_preset: buildDeleteEncounterPresetRequest,
  delete_formula: buildDeleteFormulaRequest,
  delete_item: buildDeleteItemRequest,
  delete_proficiency: buildDeleteProficiencyRequest,
  delete_sheet: buildDeleteSheetRequest,
  delete_sheet_action_bridge: buildDeleteSheetActionBridgeRequest,
  delete_sheet_item_bridge: buildDeleteSheetItemBridgeRequest,
  delete_sheet_proficiency_bridge: buildDeleteSheetProficiencyBridgeRequest,
  export_state_backup: buildExportStateBackupRequest,
  generate_sheet_access_code: buildGenerateSheetAccessCodeRequest,
  get_action_formula_authoring_metadata: buildGetActionFormulaAuthoringMetadataRequest,
  get_augmentation_target_metadata: buildGetAugmentationTargetMetadataRequest,
  get_roll20_bridge_status: buildGetRoll20BridgeStatusRequest,
  get_sheet_access_codes: buildGetSheetAccessCodesRequest,
  get_variable_registry: buildGetVariableRegistryRequest,
  get_xp_tracker: buildGetXpTrackerRequest,
  import_state_backup: buildImportStateBackupRequest,
  perform_action: buildPerformActionRequest,
  remove_item_augmentation_template: buildRemoveItemAugmentationTemplateRequest,
  resync_state: buildResyncStateRequest,
  save_encounter_preset: buildSaveEncounterPresetRequest,
  send_roll20_chat_message: buildSendRoll20ChatMessageRequest,
  set_instanced_sheet_notes: buildSetInstancedSheetNotesRequest,
  set_instanced_sheet_resource: buildSetInstancedSheetResourceRequest,
  set_mob_xp_value: buildSetMobXpValueRequest,
  set_sheet_base_stat: buildSetSheetBaseStatRequest,
  set_sheet_formula_stat: buildSetSheetFormulaStatRequest,
  set_sheet_resistances: buildSetSheetResistancesRequest,
  set_sheet_notes: buildSetSheetNotesRequest,
  set_sheet_mob_kill_count: buildSetSheetMobKillCountRequest,
  set_sheet_xp_required: buildSetSheetXpRequiredRequest,
  set_sheet_slayed_count: buildSetSheetSlayedCountRequest,
  spawn_encounter_preset: buildSpawnEncounterPresetRequest,
  undo_last_state_change: buildUndoLastStateChangeRequest,
  update_action: buildUpdateActionRequest,
  update_condition_preset: buildUpdateConditionPresetRequest,
  update_formula: buildUpdateFormulaRequest,
  update_item: buildUpdateItemRequest,
  update_proficiency: buildUpdateProficiencyRequest,
  update_sheet: buildUpdateSheetRequest,
  update_sheet_action_bridge: buildUpdateSheetActionBridgeRequest,
  update_sheet_item_bridge: buildUpdateSheetItemBridgeRequest,
  update_sheet_proficiency_bridge: buildUpdateSheetProficiencyBridgeRequest,
  upsert_item_augmentation_template: buildUpsertItemAugmentationTemplateRequest
} satisfies Record<ProtocolApplicationRequest["type"], unknown>;

describe("requestBuilders", () => {
  it("has request helpers for every generated registered route", () => {
    expect(Object.keys(requestBuilderByType).sort()).toEqual(
      protocolRouteContracts.map((contract) => contract.type).sort()
    );
  });

  it("builds authentication requests", () => {
    expect(buildAuthenticateRequest({ token: "player-code", requestId: "req-auth" })).toEqual({
      request_id: "req-auth",
      type: "authenticate",
      token: "player-code"
    });
  });

  it("builds Roll20 bridge status requests", () => {
    expect(buildGetRoll20BridgeStatusRequest({ requestId: "req-status" })).toEqual({
      type: "get_roll20_bridge_status",
      request_id: "req-status"
    });
  });

  it("builds XP tracker requests", () => {
    expect(buildGetXpTrackerRequest()).toEqual({ type: "get_xp_tracker" });
    expect(buildSetSheetXpRequiredRequest({ sheetId: "hero", xpRequired: 100 })).toEqual({
      type: "set_sheet_xp_required",
      sheet_id: "hero",
      xp_required: 100
    });
    expect(buildSetMobXpValueRequest({ mobSheetId: "goblin", xpValue: 25 })).toEqual({
      type: "set_mob_xp_value",
      mob_sheet_id: "goblin",
      xp_value: 25
    });
    expect(
      buildSetSheetMobKillCountRequest({
        sheetId: "hero_instance",
        mobSheetId: "goblin",
        count: 3
      })
    ).toEqual({
      type: "set_sheet_mob_kill_count",
      sheet_id: "hero_instance",
      mob_sheet_id: "goblin",
      count: 3
    });
  });

  it("builds sheet access code claim requests", () => {
    expect(buildClaimSheetAccessCodeRequest({ code: "MAGE2026" })).toEqual({
      type: "claim_sheet_access_code",
      code: "MAGE2026"
    });
  });

  it("builds sheet access-code admin requests", () => {
    expect(
      buildGenerateSheetAccessCodeRequest({
        requestId: "req-code",
        sheetId: "sheet_1",
        instanceId: null
      })
    ).toEqual({
      request_id: "req-code",
      type: "generate_sheet_access_code",
      sheet_id: "sheet_1",
      instance_id: null
    });
    expect(buildGetSheetAccessCodesRequest()).toEqual({
      type: "get_sheet_access_codes"
    });
  });

  it("builds registry, chat, and state-sync utility requests", () => {
    expect(buildGetVariableRegistryRequest({ requestId: "req-registry" })).toEqual({
      request_id: "req-registry",
      type: "get_variable_registry"
    });
    expect(buildSendRoll20ChatMessageRequest({ message: "/em checks the door." })).toEqual({
      type: "send_roll20_chat_message",
      message: "/em checks the door."
    });
    expect(buildResyncStateRequest({ requestId: "req-resync", lastSeenVersion: 12 })).toEqual({
      request_id: "req-resync",
      type: "resync_state",
      last_seen_version: 12
    });
    expect(buildUndoLastStateChangeRequest({ requestId: "req-undo" })).toEqual({
      request_id: "req-undo",
      type: "undo_last_state_change"
    });
  });

  it("builds state backup requests", () => {
    expect(buildExportStateBackupRequest({ requestId: "req-export" })).toEqual({
      request_id: "req-export",
      type: "export_state_backup"
    });
    expect(
      buildImportStateBackupRequest({
        requestId: "req-import",
        persistedStateJson: '{"schema_version":1,"state":{}}'
      })
    ).toEqual({
      request_id: "req-import",
      type: "import_state_backup",
      persisted_state_json: '{"schema_version":1,"state":{}}'
    });
  });

  it("builds encounter preset requests", () => {
    expect(
      buildSaveEncounterPresetRequest({
        requestId: "req-encounter-save",
        encounter: testEncounter
      })
    ).toEqual({
      request_id: "req-encounter-save",
      type: "save_encounter_preset",
      encounter: testEncounter
    });
    expect(buildDeleteEncounterPresetRequest({ encounterId: "encounter_1" })).toEqual({
      type: "delete_encounter_preset",
      encounter_id: "encounter_1"
    });
    expect(buildSpawnEncounterPresetRequest({ encounterId: "encounter_1" })).toEqual({
      type: "spawn_encounter_preset",
      encounter_id: "encounter_1"
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

  it("builds typed damage requests", () => {
    expect(
      buildApplyInstancedSheetDamageRequest({
        requestId: "req-damage",
        instanceId: "instance_1",
        amount: 12,
        damageType: "Fire"
      })
    ).toEqual({
      request_id: "req-damage",
      type: "apply_instanced_sheet_damage",
      instance_id: "instance_1",
      amount: 12,
      damage_type: "Fire"
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

  it("builds notes and formula stat update requests", () => {
    expect(
      buildSetInstancedSheetNotesRequest({
        instanceId: "instance_1",
        notes: "Player-visible note."
      })
    ).toEqual({
      type: "set_instanced_sheet_notes",
      instance_id: "instance_1",
      notes: "Player-visible note."
    });
    expect(
      buildSetSheetNotesRequest({
        sheetId: "sheet_1",
        notes: "GM template note."
      })
    ).toEqual({
      type: "set_sheet_notes",
      sheet_id: "sheet_1",
      notes: "GM template note."
    });
    expect(
      buildSetSheetSlayedCountRequest({
        requestId: "req-xp",
        sheetId: "sheet_1",
        slayedSheetId: "enemy_1",
        count: 3
      })
    ).toEqual({
      request_id: "req-xp",
      type: "set_sheet_slayed_count",
      sheet_id: "sheet_1",
      slayed_sheet_id: "enemy_1",
      count: 3
    });
    expect(
      buildSetSheetFormulaStatRequest({
        sheetId: "sheet_1",
        statName: "health",
        formula: {
          aliases: null,
          text: "30 + @constitution"
        }
      })
    ).toEqual({
      type: "set_sheet_formula_stat",
      sheet_id: "sheet_1",
      stat_name: "health",
      formula: {
        aliases: null,
        text: "30 + @constitution"
      }
    });
    expect(
      buildSetSheetResistancesRequest({
        sheetId: "sheet_1",
        resistances: {
          resistance: 0.1,
          physical: 0.2,
          magical: 0.3,
          fire: 0.4
        }
      })
    ).toEqual({
      type: "set_sheet_resistances",
      sheet_id: "sheet_1",
      resistances: {
        resistance: 0.1,
        physical: 0.2,
        magical: 0.3,
        fire: 0.4
      }
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

  it("builds sheet action bridge CRUD requests", () => {
    const bridge = {
      relationship_id: "default_attack",
      action_id: "attack"
    };

    expect(buildCreateSheetActionBridgeRequest({ sheetId: "sheet_1", bridge })).toEqual({
      type: "create_sheet_action_bridge",
      sheet_id: "sheet_1",
      bridge
    });
    expect(
      buildUpdateSheetActionBridgeRequest({
        requestId: "req-action-bridge",
        sheetId: "sheet_1",
        relationshipId: "default_attack",
        bridge
      })
    ).toEqual({
      request_id: "req-action-bridge",
      type: "update_sheet_action_bridge",
      sheet_id: "sheet_1",
      relationship_id: "default_attack",
      bridge
    });
    expect(
      buildDeleteSheetActionBridgeRequest({
        sheetId: "sheet_1",
        relationshipId: "default_attack"
      })
    ).toEqual({
      type: "delete_sheet_action_bridge",
      sheet_id: "sheet_1",
      relationship_id: "default_attack"
    });
  });

  it("builds sheet proficiency bridge CRUD requests", () => {
    const bridge = {
      relationship_id: "prof_sword",
      prof_id: "sword",
      use_count: 2,
      growth_rate: 1
    };

    expect(buildCreateSheetProficiencyBridgeRequest({ sheetId: "sheet_1", bridge })).toEqual({
      type: "create_sheet_proficiency_bridge",
      sheet_id: "sheet_1",
      bridge
    });
    expect(
      buildUpdateSheetProficiencyBridgeRequest({
        requestId: "req-prof-bridge",
        sheetId: "sheet_1",
        relationshipId: "prof_sword",
        bridge
      })
    ).toEqual({
      request_id: "req-prof-bridge",
      type: "update_sheet_proficiency_bridge",
      sheet_id: "sheet_1",
      relationship_id: "prof_sword",
      bridge
    });
    expect(
      buildDeleteSheetProficiencyBridgeRequest({
        sheetId: "sheet_1",
        relationshipId: "prof_sword"
      })
    ).toEqual({
      type: "delete_sheet_proficiency_bridge",
      sheet_id: "sheet_1",
      relationship_id: "prof_sword"
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

  it("builds proficiency CRUD requests", () => {
    expect(
      buildCreateProficiencyRequest({
        proficiency: testProficiency
      })
    ).toEqual({
      type: "create_proficiency",
      proficiency: testProficiency
    });
    expect(
      buildUpdateProficiencyRequest({
        requestId: "req-proficiency-update",
        proficiencyId: "longsword",
        proficiency: {
          ...testProficiency,
          name: "Longsword Mastery"
        }
      })
    ).toEqual({
      request_id: "req-proficiency-update",
      type: "update_proficiency",
      proficiency_id: "longsword",
      proficiency: {
        ...testProficiency,
        name: "Longsword Mastery"
      }
    });
    expect(
      buildDeleteProficiencyRequest({
        proficiencyId: "longsword"
      })
    ).toEqual({
      type: "delete_proficiency",
      proficiency_id: "longsword"
    });
  });

  it("builds item delete requests", () => {
    expect(buildDeleteItemRequest({ itemId: "item_1" })).toEqual({
      type: "delete_item",
      item_id: "item_1"
    });
  });

  it("builds item augmentation template upsert requests", () => {
    expect(
      buildUpsertItemAugmentationTemplateRequest({
        requestId: "req-augmentation-upsert",
        itemId: "item_1",
        augmentation: testAugmentation
      })
    ).toEqual({
      request_id: "req-augmentation-upsert",
      type: "upsert_item_augmentation_template",
      item_id: "item_1",
      augmentation: testAugmentation
    });
  });

  it("builds item augmentation template remove requests", () => {
    expect(
      buildRemoveItemAugmentationTemplateRequest({
        itemId: "item_1",
        augmentationId: "aug_1"
      })
    ).toEqual({
      type: "remove_item_augmentation_template",
      item_id: "item_1",
      augmentation_id: "aug_1"
    });
  });

  it("builds formula create requests", () => {
    expect(buildCreateFormulaRequest({ formula: testFormulaDefinition })).toEqual({
      type: "create_formula",
      formula: testFormulaDefinition
    });
  });

  it("builds formula update requests", () => {
    expect(
      buildUpdateFormulaRequest({
        requestId: "req-formula-update",
        formulaId: "formula_1",
        formula: {
          ...testFormulaDefinition,
          formula: {
            aliases: testFormulaDefinition.formula.aliases,
            text: "@arcane * 10"
          }
        }
      })
    ).toEqual({
      request_id: "req-formula-update",
      type: "update_formula",
      formula_id: "formula_1",
      formula: {
        ...testFormulaDefinition,
        formula: {
          aliases: testFormulaDefinition.formula.aliases,
          text: "@arcane * 10"
        }
      }
    });
  });

  it("builds formula delete requests", () => {
    expect(buildDeleteFormulaRequest({ formulaId: "formula_1" })).toEqual({
      type: "delete_formula",
      formula_id: "formula_1"
    });
  });

  it("builds action create requests", () => {
    expect(buildCreateActionRequest({ action: testAction })).toEqual({
      type: "create_action",
      action: testAction
    });
  });

  it("builds action update requests", () => {
    expect(
      buildUpdateActionRequest({
        requestId: "req-action-update",
        actionId: "action_1",
        action: {
          ...testAction,
          name: "Edited Mana Burst"
        }
      })
    ).toEqual({
      request_id: "req-action-update",
      type: "update_action",
      action_id: "action_1",
      action: {
        ...testAction,
        name: "Edited Mana Burst"
      }
    });
  });

  it("builds action delete requests", () => {
    expect(buildDeleteActionRequest({ actionId: "action_1" })).toEqual({
      type: "delete_action",
      action_id: "action_1"
    });
  });

  it("builds authored action execution requests", () => {
    expect(
      buildPerformActionRequest({
        requestId: "req-action-execute",
        sheetId: "instance_1",
        actionId: "attack"
      })
    ).toEqual({
      request_id: "req-action-execute",
      type: "perform_action",
      sheet_id: "instance_1",
      action_id: "attack"
    });
  });

  it("builds authored action execution requests with target ids", () => {
    expect(
      buildPerformActionRequest({
        sheetId: "instance_1",
        actionId: "heal",
        targetSheetId: null
      })
    ).toEqual({
      type: "perform_action",
      sheet_id: "instance_1",
      action_id: "heal",
      target_sheet_id: null
    });
  });

  it("builds authored action execution requests with a roll mode", () => {
    expect(
      buildPerformActionRequest({
        sheetId: "instance_1",
        actionId: "dodge",
        rollMode: "disadvantage"
      })
    ).toEqual({
      type: "perform_action",
      sheet_id: "instance_1",
      action_id: "dodge",
      roll_mode: "disadvantage"
    });
  });

  it("builds critical damage action execution requests", () => {
    expect(
      buildPerformActionRequest({
        sheetId: "instance_1",
        actionId: "sword_damage",
        rollMode: "critical"
      })
    ).toEqual({
      type: "perform_action",
      sheet_id: "instance_1",
      action_id: "sword_damage",
      roll_mode: "critical"
    });
  });

  it("builds item-granted action execution requests with a source relationship", () => {
    expect(
      buildPerformActionRequest({
        sheetId: "instance_1",
        actionId: "drink_potion",
        sourceItemRelationshipId: "inventory_potion_2"
      })
    ).toEqual({
      type: "perform_action",
      sheet_id: "instance_1",
      action_id: "drink_potion",
      source_item_relationship_id: "inventory_potion_2"
    });
  });

  it("builds action/formula authoring metadata requests", () => {
    expect(buildGetActionFormulaAuthoringMetadataRequest()).toEqual({
      type: "get_action_formula_authoring_metadata"
    });
    expect(buildGetActionFormulaAuthoringMetadataRequest({ requestId: "req-metadata" })).toEqual({
      request_id: "req-metadata",
      type: "get_action_formula_authoring_metadata"
    });
  });

  it("builds augmentation target metadata requests", () => {
    expect(buildGetAugmentationTargetMetadataRequest()).toEqual({
      type: "get_augmentation_target_metadata"
    });
    expect(
      buildGetAugmentationTargetMetadataRequest({
        context: "condition_template",
        requestId: "req-targets"
      })
    ).toEqual({
      context: "condition_template",
      request_id: "req-targets",
      type: "get_augmentation_target_metadata"
    });
  });
});
