import type {
  Augmentation,
  AttributeBridge,
  AttributeDefinition,
  ItemDefinition,
  ItemInteractionType,
  ItemPlayerCatalogAccess,
  ProficiencyDefinition
} from "@/domain/models";
import type { ItemDefinitionPayload } from "@/infrastructure/ws/requestBuilders";
import { makeId } from "@/shared/utils/id";

export type ItemEditorValues = {
  name: string;
  interactionType: ItemInteractionType;
  rank: string;
  weight: string;
  playerCatalogAccess: ItemPlayerCatalogAccess;
  canContainItems: boolean;
  storageCapacityWeight: string;
  contentsWeightBehavior: "normal" | "ignored";
  value: string;
  worldAnvilUrl: string;
  gmNotes: string;
  gmSpecialProperties: string;
  description: string;
  tags: string[];
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
    rank: ITEM_RANK_OPTIONS[0],
    weight: "0",
    playerCatalogAccess: { mode: "none", instanceIds: [] },
    canContainItems: false,
    storageCapacityWeight: "",
    contentsWeightBehavior: "normal",
    value: "",
    worldAnvilUrl: "",
    gmNotes: "",
    gmSpecialProperties: "",
    description: "",
    tags: [],
    attributes: {},
    augmentationTemplates: [],
    actionGrants: []
  };
}

export function toItemEditorValues(item: ItemDefinition): ItemEditorValues {
  return {
    name: item.name,
    interactionType: item.interaction_type,
    rank: item.rank || ITEM_RANK_OPTIONS[0],
    weight: String(item.weight),
    playerCatalogAccess: {
      mode: item.player_catalog_access?.mode ?? "all",
      instanceIds: [...(item.player_catalog_access?.instanceIds ?? [])]
    },
    canContainItems: item.can_contain_items ?? false,
    storageCapacityWeight:
      item.storage_capacity_weight == null ? "" : String(item.storage_capacity_weight),
    contentsWeightBehavior: item.contents_weight_behavior ?? "normal",
    value: item.price,
    worldAnvilUrl: item.world_anvil_url ?? "",
    gmNotes: item.gm_notes ?? "",
    gmSpecialProperties: item.gm_special_properties ?? "",
    description: item.description ?? "",
    tags: [...(item.tags ?? [])],
    attributes: Object.fromEntries(
      Object.entries(item.attributes ?? {}).map(([attributeId, bridge]) => [
        attributeId,
        structuredClone(bridge)
      ])
    ),
    augmentationTemplates: [...(item.augmentation_templates ?? [])],
    actionGrants: (item.action_grants ?? []).map((grant) => ({
      draftId: `item_grant_${grant.action_id}`,
      actionId: grant.action_id,
      availability: grant.availability,
      consumeQuantity: String(grant.consume_quantity ?? 0)
    }))
  };
}

export function createItemValuesFromTemplate(template: ItemDefinition): ItemEditorValues {
  const values = toItemEditorValues(template);
  return {
    ...values,
    playerCatalogAccess: { mode: "none", instanceIds: [] },
    attributes: Object.fromEntries(
      Object.entries(values.attributes).map(([attributeId, bridge]) => [
        attributeId,
        {
          ...structuredClone(bridge),
          relationship_id: makeId("item_attribute")
        }
      ])
    ),
    augmentationTemplates: values.augmentationTemplates.map((augmentation) => ({
      ...structuredClone(augmentation),
      id: makeId("augmentation")
    })),
    actionGrants: values.actionGrants.map((grant) => ({
      ...grant,
      draftId: makeId("item_action")
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
  if (!values.canContainItems && values.storageCapacityWeight.trim()) {
    return "Only storage containers can define a storage weight limit.";
  }
  if (values.canContainItems && values.storageCapacityWeight.trim()) {
    const storageCapacityWeight = Number(values.storageCapacityWeight);
    if (!Number.isFinite(storageCapacityWeight) || storageCapacityWeight < 0) {
      return "Storage weight limit must be a finite nonnegative number in pounds.";
    }
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
    rank: values.rank.trim(),
    description: values.description.trim(),
    world_anvil_url: values.worldAnvilUrl.trim(),
    gm_notes: values.gmNotes.trim(),
    gm_special_properties:
      values.interactionType === "inventory_only" ? "" : values.gmSpecialProperties.trim(),
    price: values.value.trim(),
    weight: Number(values.weight),
    player_catalog_access: {
      mode: values.playerCatalogAccess.mode,
      instance_ids:
        values.playerCatalogAccess.mode === "selected"
          ? [...values.playerCatalogAccess.instanceIds]
          : []
    },
    can_contain_items: values.canContainItems,
    storage_capacity_weight:
      values.canContainItems && values.storageCapacityWeight.trim()
        ? Number(values.storageCapacityWeight)
        : null,
    contents_weight_behavior: values.canContainItems ? values.contentsWeightBehavior : "normal",
    tags: [...values.tags],
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
    rank: values.rank.trim(),
    description: values.description.trim(),
    world_anvil_url: values.worldAnvilUrl.trim(),
    gm_notes: values.gmNotes.trim(),
    gm_special_properties:
      values.interactionType === "inventory_only" ? "" : values.gmSpecialProperties.trim(),
    price: values.value.trim(),
    weight: Number(values.weight),
    player_catalog_access: {
      mode: values.playerCatalogAccess.mode,
      instance_ids:
        values.playerCatalogAccess.mode === "selected"
          ? [...values.playerCatalogAccess.instanceIds]
          : []
    },
    can_contain_items: values.canContainItems,
    storage_capacity_weight:
      values.canContainItems && values.storageCapacityWeight.trim()
        ? Number(values.storageCapacityWeight)
        : null,
    contents_weight_behavior: values.canContainItems ? values.contentsWeightBehavior : "normal",
    tags: [...values.tags],
    attributes: values.attributes,
    augmentation_templates: toAugmentationTemplatePayloads(values, item.id),
    action_grants: toActionGrantPayloads(values)
  };
}
