import type { Augmentation, ItemDefinition, ItemInteractionType } from "@/domain/models";
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
    augmentationTemplates: [],
    actionGrants: []
  };
}

function readDescriptionField(description: string, label: string): string {
  const prefix = `${label}:`;
  const line = description.split("\n").find((entry) => entry.trim().startsWith(prefix));
  return line?.slice(prefix.length).trim() ?? "";
}

function hasLegacyLabeledDescription(description: string): boolean {
  return ["Type", "Rank", "Immediate Effects", "Non-Immediate Effects"].some((label) =>
    description.split("\n").some((entry) => entry.trim().startsWith(`${label}:`))
  );
}

function migrateLegacyDescription(description: string): string {
  if (!hasLegacyLabeledDescription(description)) {
    return description;
  }

  const legacyImmediate = readDescriptionField(description, "Immediate Effects");
  const legacyNonImmediate = readDescriptionField(description, "Non-Immediate Effects");
  const retainedLines = description
    .split("\n")
    .filter(
      (line) =>
        !["Type", "Rank", "Immediate Effects", "Non-Immediate Effects"].some((label) =>
          line.trim().startsWith(`${label}:`)
        )
    )
    .map((line) => line.trim())
    .filter(Boolean);

  return [
    ...retainedLines,
    legacyImmediate ? `Immediate effect (legacy reference): ${legacyImmediate}` : "",
    legacyNonImmediate ? `Non-immediate effect (legacy reference): ${legacyNonImmediate}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

export function toItemEditorValues(item: ItemDefinition): ItemEditorValues {
  const description = item.description ?? "";
  return {
    name: item.name,
    interactionType: item.interaction_type,
    type: item.category ?? readDescriptionField(description, "Type"),
    rank: item.rank || readDescriptionField(description, "Rank") || ITEM_RANK_OPTIONS[0],
    weight: item.weight,
    value: item.price,
    worldAnvilUrl: item.world_anvil_url ?? "",
    gmNotes: item.gm_notes ?? "",
    gmSpecialProperties: item.gm_special_properties ?? "",
    description: migrateLegacyDescription(description),
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

export function getItemEditorValidationError(values: ItemEditorValues): string | null {
  if (!values.name.trim()) {
    return "Name is required.";
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
    augmentation_templates: toAugmentationTemplatePayloads(values, item.id),
    action_grants: toActionGrantPayloads(values)
  };
}
