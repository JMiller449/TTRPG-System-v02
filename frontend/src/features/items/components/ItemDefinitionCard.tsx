import type {
  ActionDefinition,
  AttributeDefinition,
  ItemDefinition,
  ItemInteractionType
} from "@/domain/models";
import { toItemEditorValues } from "@/features/items/itemEditorValues";
import { formatWeight } from "@/features/sheets/inventoryDisplay";
import { SheetAttributesSection } from "@/features/sheets/components/SheetAttributesSection";

const ITEM_TYPE_LABELS: Record<ItemInteractionType, string> = {
  equippable: "Equippable",
  consumable: "Consumable",
  inventory_only: "Inventory Only"
};

export function ItemDefinitionCard({
  item,
  actions,
  attributeDefinitions,
  onEdit,
  onDelete
}: {
  item: ItemDefinition;
  actions: Record<string, ActionDefinition>;
  attributeDefinitions: Record<string, AttributeDefinition>;
  onEdit: () => void;
  onDelete: () => void;
}): JSX.Element {
  const preview = toItemEditorValues(item);
  const wearerEffectCount =
    item.augmentation_templates?.filter(
      (augmentation) => augmentation.effect.type === "formula_modifier"
    ).length ?? 0;
  const rollFormulaEffectCount =
    item.augmentation_templates?.filter(
      (augmentation) => augmentation.effect.type !== "formula_modifier"
    ).length ?? 0;
  const actionGrantCount = item.action_grants?.length ?? 0;
  const conditionIds = new Set(
    (item.action_grants ?? []).flatMap((grant) =>
      (actions[grant.action_id]?.steps ?? [])
        .filter((step) => step.type === "apply_condition_preset")
        .map((step) => step.condition_id)
    )
  );

  return (
    <article className="list-item list-item--block item-definition-card">
      <div className="list-item__top">
        <strong>{item.name}</strong>
        {item.world_anvil_url ? (
          <a className="muted" href={item.world_anvil_url} target="_blank" rel="noreferrer">
            World Anvil
          </a>
        ) : null}
      </div>
      <div className="muted">
        {ITEM_TYPE_LABELS[item.interaction_type]} · {preview.type || "Item"} · Rank {preview.rank} ·
        Weight {formatWeight(item.weight)} lb · Price {item.price || "(none)"}
      </div>
      {preview.description ? (
        <div className="muted item-definition-card__description">{preview.description}</div>
      ) : null}
      {item.interaction_type === "equippable" ? (
        <>
          <div className="muted">Wearer Effects: {wearerEffectCount}</div>
          <div className="muted">Roll / Formula Effects: {rollFormulaEffectCount}</div>
          <div className="muted">Equipped Actions: {actionGrantCount}</div>
          <div className="muted">Named Conditions Through Actions: {conditionIds.size}</div>
        </>
      ) : null}
      {item.interaction_type === "consumable" ? (
        <>
          <div className="muted">Use Actions: {actionGrantCount}</div>
          <div className="muted">Named Conditions Through Actions: {conditionIds.size}</div>
        </>
      ) : null}
      {item.gm_notes ? <div className="muted">GM Notes: {item.gm_notes}</div> : null}
      {item.gm_special_properties ? (
        <div className="muted">GM Special Properties: {item.gm_special_properties}</div>
      ) : null}
      {Object.keys(item.attributes ?? {}).length > 0 ? (
        <SheetAttributesSection
          definitions={attributeDefinitions}
          bridges={item.attributes ?? {}}
          canEdit={false}
          subjectType="item"
          onSaveFormula={() => undefined}
          onReset={() => undefined}
        />
      ) : null}
      <div className="inline-actions">
        <button className="button button--secondary" type="button" onClick={onEdit}>
          Edit
        </button>
        <button className="button button--secondary" type="button" onClick={onDelete}>
          Delete
        </button>
      </div>
    </article>
  );
}
