import { describe, expect, it } from "vitest";
import { initialServerState } from "@/app/state/initialState";
import type { AttributeDefinition } from "@/domain/models";
import {
  attachContextualRecord,
  resolveTemplateContextualCreate,
  type PendingTemplateContextualCreate,
  type TemplateContextualEntityKind
} from "@/features/sheets/templateContextualAuthoring";
import { createEmptyTemplateEditorValues } from "@/features/sheets/templateEditorValues";

const createdAttribute: AttributeDefinition = {
  id: "movement",
  name: "Movement",
  subject_types: ["sheet"],
  value_type: "number",
  default_value: { type: "number", value: 30 },
  unit: "feet"
};

function pending(kind: TemplateContextualEntityKind): PendingTemplateContextualCreate {
  return { kind, entityId: `${kind}_new`, requestId: `request_${kind}` };
}

describe("template contextual authoring", () => {
  it("waits for matching success and authoritative catalog arrival", () => {
    const create = pending("action");
    const success = {
      id: "feedback",
      intentId: create.requestId,
      status: "success" as const,
      message: "Created",
      createdAt: "now"
    };

    expect(resolveTemplateContextualCreate(create, [], initialServerState)).toBe("pending");
    expect(resolveTemplateContextualCreate(create, [success], initialServerState)).toBe("pending");
    expect(
      resolveTemplateContextualCreate(create, [success], {
        ...initialServerState,
        actions: { action_new: { id: "action_new", name: "New Action" } }
      })
    ).toBe("success");
    expect(
      resolveTemplateContextualCreate(
        create,
        [
          {
            ...success,
            status: "error",
            message: "Rejected"
          }
        ],
        initialServerState
      )
    ).toBe("error");
  });

  it("attaches every record type with canonical defaults while preserving the draft", () => {
    const original = createEmptyTemplateEditorValues("player");
    original.name = "Unsaved Hero";
    original.notes = "Keep this draft";
    const originalStats = original.coreStats;
    const originalResistances = original.resistances;
    let id = 0;
    const makeRelationshipId = (prefix: string): string => `${prefix}_${++id}`;

    const withAttribute = attachContextualRecord(
      original,
      "attribute",
      createdAttribute.id,
      createdAttribute,
      makeRelationshipId
    );
    const withAction = attachContextualRecord(
      withAttribute,
      "action",
      "new_action",
      {},
      makeRelationshipId
    );
    const withItem = attachContextualRecord(withAction, "item", "new_item", {}, makeRelationshipId);
    const completed = attachContextualRecord(
      withItem,
      "proficiency",
      "new_proficiency",
      {},
      makeRelationshipId
    );

    expect(completed.name).toBe("Unsaved Hero");
    expect(completed.notes).toBe("Keep this draft");
    expect(completed.coreStats).toBe(originalStats);
    expect(completed.resistances).toBe(originalResistances);
    expect(completed.attributes.movement).toMatchObject({
      relationship_id: "sheet_attribute_1",
      attribute_id: "movement",
      value: { type: "number", value: 30 }
    });
    expect(completed.actions).toEqual([
      { relationshipId: "sheet_action_2", actionId: "new_action" }
    ]);
    expect(completed.items).toEqual([
      {
        relationshipId: "sheet_item_3",
        itemId: "new_item",
        count: "1",
        equipped: false
      }
    ]);
    expect(completed.proficiencies).toEqual([
      {
        relationshipId: "sheet_proficiency_4",
        proficiencyId: "new_proficiency",
        useCount: "0",
        growthRate: "1"
      }
    ]);
  });

  it("does not attach duplicates or non-sheet Attributes", () => {
    const values = createEmptyTemplateEditorValues();
    const first = attachContextualRecord(values, "action", "action_1", {}, () => "bridge_1");
    expect(attachContextualRecord(first, "action", "action_1", {}, () => "bridge_2")).toBe(first);

    const itemAttribute = { ...createdAttribute, id: "item_attribute", subject_types: ["item" as const] };
    expect(attachContextualRecord(values, "attribute", itemAttribute.id, itemAttribute, () => "attribute_bridge")).toBe(
      values
    );
  });
});
