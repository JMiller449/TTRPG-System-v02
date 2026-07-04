import type { IntentFeedbackItem, ServerState } from "@/app/state/types";
import type { FactDefinition } from "@/domain/models";
import type { TemplateEditorValues } from "@/features/sheets/templateEditorTypes";

export type TemplateContextualEntityKind = "fact" | "action" | "item" | "proficiency";

export interface PendingTemplateContextualCreate {
  kind: TemplateContextualEntityKind;
  entityId: string;
  requestId: string;
}

export type TemplateContextualCreateResolution = "pending" | "error" | "success";

export function contextualRecord(
  serverState: ServerState,
  kind: TemplateContextualEntityKind,
  entityId: string
): FactDefinition | object | undefined {
  if (kind === "fact") {
    return serverState.facts[entityId];
  }
  if (kind === "action") {
    return serverState.actions[entityId];
  }
  if (kind === "item") {
    return serverState.items[entityId];
  }
  return serverState.proficiencies[entityId];
}

export function resolveTemplateContextualCreate(
  pending: PendingTemplateContextualCreate,
  feedback: IntentFeedbackItem[],
  serverState: ServerState
): TemplateContextualCreateResolution {
  const matchingFeedback = feedback.find((entry) => entry.intentId === pending.requestId);
  if (matchingFeedback?.status === "error") {
    return "error";
  }
  if (
    matchingFeedback?.status === "success" &&
    contextualRecord(serverState, pending.kind, pending.entityId)
  ) {
    return "success";
  }
  return "pending";
}

export function attachContextualRecord(
  values: TemplateEditorValues,
  kind: TemplateContextualEntityKind,
  entityId: string,
  record: FactDefinition | object,
  makeRelationshipId: (prefix: string) => string
): TemplateEditorValues {
  if (kind === "fact") {
    const definition = record as FactDefinition;
    if (
      values.facts[entityId] ||
      definition.id !== entityId ||
      !definition.subject_types.includes("sheet")
    ) {
      return values;
    }
    return {
      ...values,
      facts: {
        ...values.facts,
        [entityId]: {
          relationship_id: makeRelationshipId("sheet_fact"),
          fact_id: entityId,
          value: structuredClone(definition.default_value),
          evaluated_value: null,
          evaluation_error: null
        }
      }
    };
  }

  if (kind === "action") {
    if (values.actions.some((entry) => entry.actionId === entityId)) {
      return values;
    }
    return {
      ...values,
      actions: [
        ...values.actions,
        { relationshipId: makeRelationshipId("sheet_action"), actionId: entityId }
      ]
    };
  }

  if (kind === "item") {
    if (values.items.some((entry) => entry.itemId === entityId)) {
      return values;
    }
    return {
      ...values,
      items: [
        ...values.items,
        {
          relationshipId: makeRelationshipId("sheet_item"),
          itemId: entityId,
          count: "1",
          equipped: false
        }
      ]
    };
  }

  if (values.proficiencies.some((entry) => entry.proficiencyId === entityId)) {
    return values;
  }
  return {
    ...values,
    proficiencies: [
      ...values.proficiencies,
      {
        relationshipId: makeRelationshipId("sheet_proficiency"),
        proficiencyId: entityId,
        useCount: "0",
        growthRate: "1"
      }
    ]
  };
}
