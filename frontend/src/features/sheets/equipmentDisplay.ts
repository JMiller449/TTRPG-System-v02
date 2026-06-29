import type {
  ActionDefinition,
  Augmentation,
  ItemBridge,
  ItemDefinition,
  ItemInteractionType
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
