import type {
  Augmentation,
  AttributeBridge,
  AttributeDefinition,
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
  canContainItems: boolean;
  contentsWeightBehavior: "normal" | "ignored";
  value: string;
  worldAnvilUrl: string;
  gmNotes: string;
  gmSpecialProperties: string;
  description: string;
  attributeProfile: "weapon" | null;
  attributes: Record<string, AttributeBridge>;
  augmentationTemplates: Augmentation[];
  actionGrants: ItemActionGrantEditorValues[];
};

export type ItemActionGrantEditorValues = {
  draftId?: string;
  actionId: string;
  availability: "carried" | "equipped";
  consumeQuantity: string;
};

export const WEAPON_ACTION_IDS = [
  "weapon_attack",
  "weapon_damage",
  "weapon_parry",
  "weapon_contest"
] as const;

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
    weight: "0",
    canContainItems: false,
    contentsWeightBehavior: "normal",
    value: "",
    worldAnvilUrl: "",
    gmNotes: "",
    gmSpecialProperties: "",
    description: "",
    attributeProfile: null,
    attributes: {},
    augmentationTemplates: [],
    actionGrants: []
  };
}

function canonicalWeaponActionGrants(): ItemActionGrantEditorValues[] {
  return WEAPON_ACTION_IDS.map((actionId) => ({
    draftId: `weapon_grant_${actionId}`,
    actionId,
    availability: "equipped",
    consumeQuantity: "0"
  }));
}

function normalizeWeaponActionGrantValues(
  grants: ItemActionGrantEditorValues[]
): ItemActionGrantEditorValues[] {
  return [
    ...grants.filter((grant) => !(WEAPON_ACTION_IDS as readonly string[]).includes(grant.actionId)),
    ...canonicalWeaponActionGrants()
  ];
}

export function setItemAttributeProfile(
  values: ItemEditorValues,
  attributeProfile: "weapon" | null,
  definitions: Record<string, AttributeDefinition>
): ItemEditorValues {
  const attributes = Object.fromEntries(
    Object.entries(values.attributes).filter(
      ([attributeId]) => !definitions[attributeId]?.required_profile
    )
  );
  for (const definition of Object.values(definitions)) {
    if (definition.required_profile !== attributeProfile) {
      continue;
    }
    attributes[definition.id] = {
      relationship_id: `required_attribute_${definition.id}`,
      attribute_id: definition.id,
      value: structuredClone(definition.default_value),
      evaluated_value: null,
      evaluation_error: null
    };
  }
  return {
    ...values,
    interactionType: attributeProfile === "weapon" ? "equippable" : values.interactionType,
    attributeProfile,
    attributes,
    actionGrants:
      attributeProfile === "weapon"
        ? normalizeWeaponActionGrantValues(values.actionGrants)
        : values.actionGrants
  };
}

export function toItemEditorValues(item: ItemDefinition): ItemEditorValues {
  return {
    name: item.name,
    interactionType: item.interaction_type,
    type: item.category ?? "",
    rank: item.rank || ITEM_RANK_OPTIONS[0],
    weight: String(item.weight),
    canContainItems: item.can_contain_items ?? false,
    contentsWeightBehavior: item.contents_weight_behavior ?? "normal",
    value: item.price,
    worldAnvilUrl: item.world_anvil_url ?? "",
    gmNotes: item.gm_notes ?? "",
    gmSpecialProperties: item.gm_special_properties ?? "",
    description: item.description ?? "",
    attributeProfile: item.attribute_profile ?? null,
    attributes: Object.fromEntries(
      Object.entries(item.attributes ?? {}).map(([attributeId, bridge]) => [
        attributeId,
        structuredClone(bridge)
      ])
    ),
    augmentationTemplates: [...(item.augmentation_templates ?? [])],
    actionGrants:
      item.attribute_profile === "weapon"
        ? normalizeWeaponActionGrantValues(
            (item.action_grants ?? []).map((grant) => ({
              draftId: `item_grant_${grant.action_id}`,
              actionId: grant.action_id,
              availability: grant.availability,
              consumeQuantity: String(grant.consume_quantity ?? 0)
            }))
          )
        : (item.action_grants ?? []).map((grant) => ({
            draftId: `item_grant_${grant.action_id}`,
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

  const grants =
    values.attributeProfile === "weapon"
      ? normalizeWeaponActionGrantValues(values.actionGrants)
      : values.actionGrants;

  return grants
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

export interface ItemAttributeValidationContext {
  definitions?: Record<string, AttributeDefinition>;
  proficiencies?: Record<string, ProficiencyDefinition>;
}

export function getItemEditorValidationError(
  values: ItemEditorValues,
  context: ItemAttributeValidationContext = {}
): string | null {
  if (!values.name.trim()) {
    return "Name is required.";
  }
  const weight = Number(values.weight);
  if (!values.weight.trim() || !Number.isFinite(weight) || weight < 0) {
    return "Weight must be a finite nonnegative number in pounds.";
  }
  if (!values.canContainItems && values.contentsWeightBehavior !== "normal") {
    return "Only storage containers can ignore the weight of their contents.";
  }
  for (const [attributeId, bridge] of Object.entries(values.attributes)) {
    const definition = context.definitions?.[attributeId];
    if (definition?.reference_kind !== "proficiency" || bridge.value.type === "formula") {
      continue;
    }
    const proficiencyId = String(bridge.value.value ?? "");
    if (proficiencyId && !context.proficiencies?.[proficiencyId]) {
      return `${definition.name} references missing proficiency ID '${proficiencyId}'. Select a replacement or clear it.`;
    }
  }
  if (values.attributeProfile === "weapon") {
    if (values.interactionType !== "equippable") {
      return "Weapon-profile items must be equippable.";
    }
    const requiredAttributes = Object.values(context.definitions ?? {}).filter(
      (definition) => definition.required_profile === "weapon"
    );
    for (const definition of requiredAttributes) {
      const bridge = values.attributes[definition.id];
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
    weight: Number(values.weight),
    can_contain_items: values.canContainItems,
    contents_weight_behavior: values.canContainItems ? values.contentsWeightBehavior : "normal",
    attribute_profile: values.attributeProfile,
    attributes: values.attributes,
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
    weight: Number(values.weight),
    can_contain_items: values.canContainItems,
    contents_weight_behavior: values.canContainItems ? values.contentsWeightBehavior : "normal",
    attribute_profile: values.attributeProfile,
    attributes: values.attributes,
    augmentation_templates: toAugmentationTemplatePayloads(values, item.id),
    action_grants: toActionGrantPayloads(values)
  };
}
