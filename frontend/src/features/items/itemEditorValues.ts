import type {
  Augmentation,
  FactBridge,
  FactDefinition,
  ItemDefinition,
  ItemInteractionType,
  ProficiencyDefinition
} from "@/domain/models";
import type { ItemDefinitionPayload } from "@/infrastructure/ws/requestBuilders";

export type ItemEditorValues = {
  name: string;
  interactionType: ItemInteractionType;
  type: string;
  rank: string;
  weight: string;
  value: string;
  worldAnvilUrl: string;
  gmNotes: string;
  gmSpecialProperties: string;
  description: string;
  factProfile: "weapon" | null;
  facts: Record<string, FactBridge>;
  augmentationTemplates: Augmentation[];
  actionGrants: ItemActionGrantEditorValues[];
};

export type ItemActionGrantEditorValues = {
  actionId: string;
  availability: "carried" | "equipped";
  consumeQuantity: string;
};

export const ITEM_RANK_OPTIONS = [
  "F",
  "F+",
  "E",
  "E+",
  "D",
  "D+",
  "C",
  "C+",
  "B",
  "B+",
  "A",
  "A+",
  "S",
  "S+",
  "SS",
  "SS+"
] as const;

export function createEmptyItemValues(): ItemEditorValues {
  return {
    name: "",
    interactionType: "equippable",
    type: "",
    rank: ITEM_RANK_OPTIONS[0],
    weight: "",
    value: "",
    worldAnvilUrl: "",
    gmNotes: "",
    gmSpecialProperties: "",
    description: "",
    factProfile: null,
    facts: {},
    augmentationTemplates: [],
    actionGrants: []
  };
}

export function setItemFactProfile(
  values: ItemEditorValues,
  factProfile: "weapon" | null,
  definitions: Record<string, FactDefinition>
): ItemEditorValues {
  const facts = Object.fromEntries(
    Object.entries(values.facts).filter(([factId]) => !definitions[factId]?.required_profile)
  );
  for (const definition of Object.values(definitions)) {
    if (definition.required_profile !== factProfile) {
      continue;
    }
    facts[definition.id] = {
      relationship_id: `required_fact_${definition.id}`,
      fact_id: definition.id,
      value: structuredClone(definition.default_value),
      evaluated_value: null,
      evaluation_error: null
    };
  }
  return {
    ...values,
    interactionType: factProfile === "weapon" ? "equippable" : values.interactionType,
    factProfile,
    facts
  };
}

export function toItemEditorValues(item: ItemDefinition): ItemEditorValues {
  return {
    name: item.name,
    interactionType: item.interaction_type,
    type: item.category ?? "",
    rank: item.rank || ITEM_RANK_OPTIONS[0],
    weight: item.weight,
    value: item.price,
    worldAnvilUrl: item.world_anvil_url ?? "",
    gmNotes: item.gm_notes ?? "",
    gmSpecialProperties: item.gm_special_properties ?? "",
    description: item.description ?? "",
    factProfile: item.fact_profile ?? null,
    facts: Object.fromEntries(
      Object.entries(item.facts ?? {}).map(([factId, bridge]) => [factId, structuredClone(bridge)])
    ),
    augmentationTemplates: [...(item.augmentation_templates ?? [])],
    actionGrants: (item.action_grants ?? []).map((grant) => ({
      actionId: grant.action_id,
      availability: grant.availability,
      consumeQuantity: String(grant.consume_quantity ?? 0)
    }))
  };
}

function toActionGrantPayloads(values: ItemEditorValues): ItemDefinitionPayload["action_grants"] {
  if (values.interactionType === "inventory_only") {
    return [];
  }

  return values.actionGrants
    .filter((grant) => grant.actionId.trim())
    .map((grant) => ({
      action_id: grant.actionId.trim(),
      availability: values.interactionType === "consumable" ? "carried" : "equipped",
      consume_quantity: grant.consumeQuantity.trim() ? Number(grant.consumeQuantity) : 0
    }));
}

function toAugmentationTemplatePayloads(
  values: ItemEditorValues,
  itemId: string
): ItemDefinitionPayload["augmentation_templates"] {
  if (values.interactionType !== "equippable") {
    return [];
  }

  return values.augmentationTemplates.map((augmentation) => ({
    ...augmentation,
    source: {
      type: "item",
      id: itemId,
      label: values.name.trim()
    },
    lifecycle_owner: "equipment",
    applied: false,
    applied_target_id: null
  }));
}

function parseQuantity(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) {
    return null;
  }
  const quantity = Number(value);
  return Number.isSafeInteger(quantity) ? quantity : null;
}

export interface ItemFactValidationContext {
  definitions?: Record<string, FactDefinition>;
  proficiencies?: Record<string, ProficiencyDefinition>;
}

export function getItemEditorValidationError(
  values: ItemEditorValues,
  context: ItemFactValidationContext = {}
): string | null {
  if (!values.name.trim()) {
    return "Name is required.";
  }
  if (values.factProfile === "weapon") {
    if (values.interactionType !== "equippable") {
      return "Weapon-profile items must be equippable.";
    }
    const requiredFacts = Object.values(context.definitions ?? {}).filter(
      (definition) => definition.required_profile === "weapon"
    );
    for (const definition of requiredFacts) {
      const bridge = values.facts[definition.id];
      if (!bridge) {
        return `Weapon profile is missing ${definition.name}.`;
      }
      const stored = bridge.value.type === "formula" ? null : bridge.value.value;
      if (definition.value_type === "text" && !String(stored ?? "").trim()) {
        return `${definition.name} is required.`;
      }
      if (definition.value_type === "list" && (!Array.isArray(stored) || stored.length === 0)) {
        return `${definition.name} requires at least one value.`;
      }
      if (
        definition.value_type === "number" &&
        (typeof stored !== "number" || !Number.isFinite(stored) || stored < 0)
      ) {
        return `${definition.name} must be nonnegative.`;
      }
      if (definition.reference_kind === "proficiency") {
        const proficiencyId = String(stored ?? "");
        if (!proficiencyId || !context.proficiencies?.[proficiencyId]) {
          return `${definition.name} must reference an existing proficiency.`;
        }
      }
    }
  }
  if (values.interactionType === "inventory_only") {
    return null;
  }
  if (values.actionGrants.some((grant) => !grant.actionId.trim())) {
    return "Select an action or remove the empty action row.";
  }

  const actionIds = values.actionGrants.map((grant) => grant.actionId.trim());
  if (new Set(actionIds).size !== actionIds.length) {
    return "Each action can be added only once.";
  }

  const quantities = values.actionGrants.map((grant) => parseQuantity(grant.consumeQuantity));
  if (quantities.some((quantity) => quantity === null)) {
    return "Quantity consumed must be a nonnegative whole number.";
  }
  if (
    values.interactionType === "consumable" &&
    !quantities.some((quantity) => quantity !== null && quantity > 0)
  ) {
    return "A consumable requires a use action that consumes at least one item.";
  }
  return null;
}

export function toItemDefinitionPayload(
  values: ItemEditorValues,
  itemId: string
): ItemDefinitionPayload {
  return {
    id: itemId,
    name: values.name.trim(),
    interaction_type: values.interactionType,
    category: values.type.trim(),
    rank: values.rank.trim(),
    description: values.description.trim(),
    world_anvil_url: values.worldAnvilUrl.trim(),
    gm_notes: values.gmNotes.trim(),
    gm_special_properties:
      values.interactionType === "inventory_only" ? "" : values.gmSpecialProperties.trim(),
    price: values.value.trim(),
    weight: values.weight.trim(),
    fact_profile: values.factProfile,
    facts: values.facts,
    augmentation_templates: toAugmentationTemplatePayloads(values, itemId),
    action_grants: toActionGrantPayloads(values)
  };
}

export function toUpdatedItemDefinitionPayload(
  item: ItemDefinition,
  values: ItemEditorValues
): ItemDefinitionPayload {
  return {
    ...item,
    name: values.name.trim(),
    interaction_type: values.interactionType,
    category: values.type.trim(),
    rank: values.rank.trim(),
    description: values.description.trim(),
    world_anvil_url: values.worldAnvilUrl.trim(),
    gm_notes: values.gmNotes.trim(),
    gm_special_properties:
      values.interactionType === "inventory_only" ? "" : values.gmSpecialProperties.trim(),
    price: values.value.trim(),
    weight: values.weight.trim(),
    fact_profile: values.factProfile,
    facts: values.facts,
    augmentation_templates: toAugmentationTemplatePayloads(values, item.id),
    action_grants: toActionGrantPayloads(values)
  };
}
