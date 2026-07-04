import type {
  ActionDefinition,
  AttributeBridge,
  AttributeDefinition,
  Augmentation,
  ItemBridge,
  ItemDefinition,
  ItemInteractionType,
  ProficiencyDefinition
} from "@/domain/models";

export const ITEM_INTERACTION_LABELS: Record<ItemInteractionType, string> = {
  equippable: "Equippable",
  consumable: "Consumable",
  inventory_only: "Inventory Only"
};

export interface ItemActionAvailabilitySummary {
  actionId: string;
  actionName: string;
  availability: "Carried" | "Equipped";
  consumeQuantity: number;
  available: boolean;
  status: string;
}

const KEY_ITEM_ATTRIBUTE_IDS = [
  "weapon_proficiency",
  "weapon_proficiency_growth_rate",
  "weapon_reach"
];
const KEY_ITEM_ATTRIBUTE_ID_SET = new Set(KEY_ITEM_ATTRIBUTE_IDS);

function displayAttributeBridgeValue(
  bridge: AttributeBridge,
  definition: AttributeDefinition | undefined,
  proficiencies: Record<string, ProficiencyDefinition>
): string {
  const rawValue =
    bridge.evaluated_value !== null && bridge.evaluated_value !== undefined
      ? bridge.evaluated_value
      : bridge.value.type === "formula"
        ? bridge.value.formula.text
        : bridge.value.value;

  if (Array.isArray(rawValue)) {
    return rawValue.join(", ");
  }
  if (typeof rawValue === "boolean") {
    return rawValue ? "Yes" : "No";
  }
  if (
    typeof rawValue === "string" &&
    definition?.reference_kind === "proficiency" &&
    proficiencies[rawValue]
  ) {
    return proficiencies[rawValue].name;
  }
  return String(rawValue);
}

function summarizeAttribute(
  bridge: AttributeBridge,
  definition: AttributeDefinition | undefined,
  proficiencies: Record<string, ProficiencyDefinition>,
  labelOverride?: string
): string {
  const label =
    labelOverride ?? definition?.name.replace(/^Weapon\s+/i, "") ?? bridge.attribute_id;
  const value = displayAttributeBridgeValue(bridge, definition, proficiencies);
  const unit = definition?.unit ? ` ${definition.unit}` : "";
  return `${label}: ${value || "None"}${unit}`;
}

export function summarizeKeyItemAttributes(
  item: ItemDefinition,
  attributeDefinitions: Record<string, AttributeDefinition>,
  proficiencies: Record<string, ProficiencyDefinition>
): string[] {
  const attributes = item.attributes ?? {};

  return KEY_ITEM_ATTRIBUTE_IDS.map((attributeId) => {
    const bridge = attributes[attributeId];
    if (!bridge) {
      return null;
    }

    const definition = attributeDefinitions[attributeId];
    const label =
      attributeId === "weapon_proficiency_growth_rate"
        ? "Growth"
        : definition?.name.replace(/^Weapon\s+/i, "") ?? attributeId;
    return summarizeAttribute(bridge, definition, proficiencies, label);
  }).filter((summary): summary is string => Boolean(summary));
}

export function summarizeItemAttributeDetails(
  item: ItemDefinition,
  attributeDefinitions: Record<string, AttributeDefinition>,
  proficiencies: Record<string, ProficiencyDefinition>
): string[] {
  const attributes = item.attributes ?? {};
  const keySummaries = summarizeKeyItemAttributes(item, attributeDefinitions, proficiencies);
  const otherSummaries = Object.values(attributes)
    .filter((bridge) => !KEY_ITEM_ATTRIBUTE_ID_SET.has(bridge.attribute_id))
    .sort((left, right) => {
      const leftName = attributeDefinitions[left.attribute_id]?.name ?? left.attribute_id;
      const rightName = attributeDefinitions[right.attribute_id]?.name ?? right.attribute_id;
      return leftName.localeCompare(rightName);
    })
    .map((bridge) =>
      summarizeAttribute(bridge, attributeDefinitions[bridge.attribute_id], proficiencies)
    );

  return [...keySummaries, ...otherSummaries];
}

export function itemCarryStatus(item: ItemDefinition, bridge: ItemBridge): string {
  if (bridge.count <= 0) {
    return "Depleted";
  }
  if (item.interaction_type === "equippable" && bridge.equipped) {
    return "Equipped";
  }
  return "Carried";
}

export function summarizeItemActionGrants(
  item: ItemDefinition,
  bridge: ItemBridge,
  actions: Record<string, ActionDefinition>
): ItemActionAvailabilitySummary[] {
  if (item.interaction_type === "inventory_only") {
    return [];
  }

  return (item.action_grants ?? []).map((grant) => {
    const action = actions[grant.action_id];
    const consumeQuantity = grant.consume_quantity ?? 0;
    let status = "Available";

    if (!action) {
      status = "Action unavailable";
    } else if (bridge.count <= 0) {
      status = "Depleted";
    } else if (grant.availability === "equipped" && !bridge.equipped) {
      status = "Requires equipped item";
    } else if (consumeQuantity > bridge.count) {
      status = `Needs ${consumeQuantity} in inventory`;
    }

    return {
      actionId: grant.action_id,
      actionName: action?.name ?? grant.action_id,
      availability: grant.availability === "equipped" ? "Equipped" : "Carried",
      consumeQuantity,
      available: status === "Available",
      status
    };
  });
}

export function selectActiveEquipmentEffects(
  augmentations: Record<string, Augmentation>,
  relationshipId: string
): Augmentation[] {
  return Object.values(augmentations).filter(
    (augmentation) =>
      augmentation.lifecycle_owner === "equipment" &&
      augmentation.source.relationship_id === relationshipId &&
      augmentation.active !== false &&
      augmentation.applied === true
  );
}

export function countItemEffectTypes(item: ItemDefinition): {
  wearer: number;
  rollOrFormula: number;
} {
  const templates = item.augmentation_templates ?? [];
  return {
    wearer: templates.filter((augmentation) => augmentation.effect.type === "formula_modifier")
      .length,
    rollOrFormula: templates.filter(
      (augmentation) => augmentation.effect.type !== "formula_modifier"
    ).length
  };
}
