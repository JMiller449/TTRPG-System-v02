import type { ItemDefinition } from "@/domain/models";
import type { ItemDefinitionPayload } from "@/infrastructure/ws/requestBuilders";

export type ItemEditorValues = {
  name: string;
  type: string;
  rank: string;
  weight: string;
  value: string;
  worldAnvilUrl: string;
  gmNotes: string;
  gmSpecialProperties: string;
  immediateEffects: string;
  nonImmediateEffects: string;
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
    type: "",
    rank: ITEM_RANK_OPTIONS[0],
    weight: "",
    value: "",
    worldAnvilUrl: "",
    gmNotes: "",
    gmSpecialProperties: "",
    immediateEffects: "",
    nonImmediateEffects: ""
  };
}

function readDescriptionField(description: string, label: string): string {
  const prefix = `${label}:`;
  const line = description
    .split("\n")
    .find((entry) => entry.trim().startsWith(prefix));
  return line?.slice(prefix.length).trim() ?? "";
}

function hasLabeledDescription(description: string): boolean {
  return ["Type", "Rank", "Immediate Effects", "Non-Immediate Effects"].some((label) =>
    description.split("\n").some((entry) => entry.trim().startsWith(`${label}:`))
  );
}

function buildItemDescription(values: ItemEditorValues): string {
  return [
    ["Type", values.type],
    ["Rank", values.rank],
    ["Immediate Effects", values.immediateEffects],
    ["Non-Immediate Effects", values.nonImmediateEffects]
  ]
    .map(([label, value]) => [label, value.trim()] as const)
    .filter(([, value]) => value.length > 0)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}

export function toItemEditorValues(item: ItemDefinition): ItemEditorValues {
  const description = item.description ?? "";
  const labeledDescription = hasLabeledDescription(description);
  return {
    name: item.name,
    type: readDescriptionField(description, "Type"),
    rank: readDescriptionField(description, "Rank") || ITEM_RANK_OPTIONS[0],
    weight: item.weight,
    value: item.price,
    worldAnvilUrl: item.world_anvil_url ?? "",
    gmNotes: item.gm_notes ?? "",
    gmSpecialProperties: item.gm_special_properties ?? "",
    immediateEffects: labeledDescription ? readDescriptionField(description, "Immediate Effects") : description,
    nonImmediateEffects: readDescriptionField(description, "Non-Immediate Effects")
  };
}

export function toItemDefinitionPayload(values: ItemEditorValues, itemId: string): ItemDefinitionPayload {
  return {
    id: itemId,
    name: values.name.trim(),
    description: buildItemDescription(values),
    world_anvil_url: values.worldAnvilUrl.trim(),
    gm_notes: values.gmNotes.trim(),
    gm_special_properties: values.gmSpecialProperties.trim(),
    price: values.value.trim(),
    weight: values.weight.trim(),
    augmentation_templates: []
  };
}

export function toUpdatedItemDefinitionPayload(
  item: ItemDefinition,
  values: ItemEditorValues
): ItemDefinitionPayload {
  return {
    ...item,
    name: values.name.trim(),
    description: buildItemDescription(values),
    world_anvil_url: values.worldAnvilUrl.trim(),
    gm_notes: values.gmNotes.trim(),
    gm_special_properties: values.gmSpecialProperties.trim(),
    price: values.value.trim(),
    weight: values.weight.trim()
  };
}
