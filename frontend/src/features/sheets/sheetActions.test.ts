import { describe, expect, it } from "vitest";
import type { AssignedSheetAction } from "@/app/state/selectors";
import type { ActionDefinition } from "@/domain/models";
import {
  selectAvailableSheetActions,
  toSheetActionBridgePayload
} from "@/features/sheets/sheetActions";

const actions: Record<string, ActionDefinition> = {
  attack: { id: "attack", name: "Attack" },
  dodge: { id: "dodge", name: "Dodge" },
  potion: { id: "potion", name: "Drink Potion" }
};

const assignedActions: AssignedSheetAction[] = [
  {
    relationshipId: "default_attack",
    actionId: "attack",
    action: actions.attack,
    bridge: { relationship_id: "default_attack", entry_id: "attack" }
  },
  {
    relationshipId: "item:potion:potion",
    actionId: "potion",
    action: actions.potion,
    sourceItemRelationshipId: "potion"
  }
];

describe("sheetActions", () => {
  it("filters explicit assignments while leaving item-granted actions assignable", () => {
    expect(
      selectAvailableSheetActions(
        actions,
        ["dodge", "missing", "attack", "potion"],
        assignedActions
      ).map((action) => action.id)
    ).toEqual(["dodge", "potion"]);
  });

  it("includes the current action when building replacement options", () => {
    expect(
      selectAvailableSheetActions(
        actions,
        ["attack", "dodge", "potion"],
        assignedActions,
        "attack"
      ).map((action) => action.id)
    ).toEqual(["attack", "dodge", "potion"]);
  });

  it("builds bridge payloads without changing stable relationship IDs", () => {
    expect(toSheetActionBridgePayload("default_attack", "dodge")).toEqual({
      relationship_id: "default_attack",
      action_id: "dodge"
    });
  });
});
