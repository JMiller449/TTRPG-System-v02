import type {
  ActionDefinition,
  Augmentation,
  AttributeDefinition,
  ItemBridge,
  ItemDefinition
} from "@/domain/models";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Field } from "@/shared/ui/Field";
import { formatAugmentationEffect } from "@/features/augmentations/augmentationEditorValues";
import { SheetAttributesSection } from "@/features/sheets/components/SheetAttributesSection";
import {
  countItemEffectTypes,
  itemCarryStatus,
  ITEM_INTERACTION_LABELS,
  selectActiveEquipmentEffects,
  summarizeItemActionGrants
} from "@/features/sheets/equipmentDisplay";

function ItemEffectSummary({
  item,
  activeEffects
}: {
  item: ItemDefinition;
  activeEffects: Augmentation[];
}): JSX.Element | null {
  if (item.interaction_type !== "equippable") {
    return null;
  }
  const counts = countItemEffectTypes(item);
  return (
    <div className="equipment-effect-summary">
      <div className="muted">
        Wearer Effects {counts.wearer} · Roll / Formula Effects {counts.rollOrFormula} · Active{" "}
        {activeEffects.length}
      </div>
      {activeEffects.map((augmentation) => (
        <div className="muted" key={augmentation.id}>
          {augmentation.name}: {formatAugmentationEffect(augmentation)}
        </div>
      ))}
    </div>
  );
}

export function SheetEquipmentSection({
  items,
  actionDefinitions,
  attributeDefinitions,
  augmentations,
  itemOrder,
  selectedItemId,
  selectedItem,
  equipment,
  canEdit,
  onSelectedItemIdChange,
  onAddSelectedItem,
  onQuantityChange,
  onToggleEquipped,
  onRemoveInventoryItem
}: {
  items: Record<string, ItemDefinition>;
  actionDefinitions: Record<string, ActionDefinition>;
  attributeDefinitions: Record<string, AttributeDefinition>;
  augmentations: Record<string, Augmentation>;
  itemOrder: string[];
  selectedItemId: string;
  selectedItem: ItemDefinition | null;
  equipment: ItemBridge[];
  canEdit: boolean;
  onSelectedItemIdChange: (itemId: string) => void;
  onAddSelectedItem: () => void;
  onQuantityChange: (inventoryItemId: string, count: number) => void;
  onToggleEquipped: (inventoryItemId: string) => void;
  onRemoveInventoryItem: (inventoryItemId: string) => void;
}): JSX.Element {
  return (
    <section className="character-sheet__section">
      <h4>Inventory &amp; Equipment</h4>
      {canEdit ? (
        <div className="equipment-add-row">
          <Field label="Item">
            <select
              value={selectedItemId}
              onChange={(event) => onSelectedItemIdChange(event.target.value)}
            >
              {itemOrder.length === 0 ? <option value="">No items loaded yet</option> : null}
              {itemOrder.map((itemId) => {
                const item = items[itemId];
                if (!item) {
                  return null;
                }
                return (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                );
              })}
            </select>
          </Field>
          <button
            type="button"
            className="button"
            onClick={onAddSelectedItem}
            disabled={!selectedItem}
          >
            Add
          </button>
        </div>
      ) : null}
      {canEdit && selectedItem ? (
        <div className="equipment-selection-preview">
          <div className="equipment-card__heading">
            <strong>{selectedItem.name}</strong>
            <span className="pill">{ITEM_INTERACTION_LABELS[selectedItem.interaction_type]}</span>
          </div>
          <div className="muted">
            Weight {selectedItem.weight} · Price {selectedItem.price}
          </div>
          <p className="muted">{selectedItem.description || "(no description)"}</p>
          {selectedItem.interaction_type === "equippable" ? (
            <ItemEffectSummary item={selectedItem} activeEffects={[]} />
          ) : null}
          {selectedItem.interaction_type !== "inventory_only" ? (
            <div className="muted">Granted Actions {selectedItem.action_grants?.length ?? 0}</div>
          ) : null}
          {Object.keys(selectedItem.attributes ?? {}).length > 0 ? (
            <SheetAttributesSection
              definitions={attributeDefinitions}
              bridges={selectedItem.attributes ?? {}}
              canEdit={false}
              subjectType="item"
              onSaveFormula={() => undefined}
              onReset={() => undefined}
            />
          ) : null}
        </div>
      ) : null}
      <div className="list">
        {equipment.length === 0 ? <EmptyState message="No inventory items." /> : null}
        {equipment.map((entry) => {
          const item = items[entry.item_id];
          if (!item) {
            return null;
          }
          const actionSummaries = summarizeItemActionGrants(item, entry, actionDefinitions);
          const activeEffects = selectActiveEquipmentEffects(augmentations, entry.relationship_id);
          return (
            <article
              key={entry.relationship_id}
              className={`list-item list-item--block equipment-card ${entry.count <= 0 ? "equipment-card--depleted" : ""}`}
            >
              <div className="equipment-card__body">
                <div className="equipment-card__heading">
                  <strong>{item.name}</strong>
                  <div className="equipment-card__status">
                    <span className="pill">{ITEM_INTERACTION_LABELS[item.interaction_type]}</span>
                    <span className="pill">{itemCarryStatus(item, entry)}</span>
                    <span className="pill">Quantity {entry.count}</span>
                  </div>
                </div>
                <div className="muted">
                  Weight {item.weight} · Price {item.price}
                </div>
                <div className="muted">{item.description || "(no description)"}</div>
                <ItemEffectSummary item={item} activeEffects={activeEffects} />
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
                {actionSummaries.length > 0 ? (
                  <div className="equipment-action-list">
                    {actionSummaries.map((summary) => (
                      <div
                        className={`equipment-action-summary ${summary.available ? "" : "equipment-action-summary--unavailable"}`}
                        key={summary.actionId}
                      >
                        <strong>{summary.actionName}</strong>
                        <span>{summary.availability}</span>
                        <span>
                          {summary.consumeQuantity > 0
                            ? `Consumes ${summary.consumeQuantity}`
                            : "No consumption"}
                        </span>
                        <span>{summary.status}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              {canEdit ? (
                <div className="inline-actions">
                  <div
                    className="equipment-quantity-stepper"
                    role="group"
                    aria-label={`${item.name} quantity`}
                  >
                    <button
                      type="button"
                      title={`Decrease ${item.name} quantity`}
                      aria-label={`Decrease ${item.name} quantity`}
                      disabled={entry.count === 0}
                      onClick={() => onQuantityChange(entry.relationship_id, entry.count - 1)}
                    >
                      -
                    </button>
                    <output aria-label={`${item.name} quantity value`}>{entry.count}</output>
                    <button
                      type="button"
                      title={`Increase ${item.name} quantity`}
                      aria-label={`Increase ${item.name} quantity`}
                      disabled={entry.count >= Number.MAX_SAFE_INTEGER}
                      onClick={() => onQuantityChange(entry.relationship_id, entry.count + 1)}
                    >
                      +
                    </button>
                  </div>
                  {item.interaction_type === "equippable" ? (
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={() => onToggleEquipped(entry.relationship_id)}
                      aria-pressed={entry.equipped}
                      disabled={!entry.equipped && entry.count <= 0}
                      aria-label={`${entry.equipped ? "Unequip" : "Equip"}: ${item.name}`}
                    >
                      {entry.equipped ? "Unequip" : "Equip"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => onRemoveInventoryItem(entry.relationship_id)}
                    aria-label={`Remove ${item.name} from inventory`}
                  >
                    Remove
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
