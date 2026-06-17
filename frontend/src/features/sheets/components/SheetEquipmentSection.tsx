import type { ItemBridge, ItemDefinition } from "@/domain/models";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Field } from "@/shared/ui/Field";

function describeAugmentations(item: ItemDefinition): string {
  if (item.stat_augmentations.length === 0) {
    return "(none)";
  }
  return item.stat_augmentations
    .map((augmentation) => `${augmentation.stat_name}: ${augmentation.augmentation.text}`)
    .join("; ");
}

export function SheetEquipmentSection({
  items,
  itemOrder,
  selectedItemTemplateId,
  selectedItem,
  activeWeaponLabel,
  equipment,
  activeWeaponId,
  canEdit,
  onSelectedItemTemplateIdChange,
  onAddSelectedTemplate,
  onToggleActiveWeapon,
  onRemoveInventoryItem
}: {
  items: Record<string, ItemDefinition>;
  itemOrder: string[];
  selectedItemTemplateId: string;
  selectedItem: ItemDefinition | null;
  activeWeaponLabel: string;
  equipment: ItemBridge[];
  activeWeaponId: string | null;
  canEdit: boolean;
  onSelectedItemTemplateIdChange: (itemTemplateId: string) => void;
  onAddSelectedTemplate: () => void;
  onToggleActiveWeapon: (inventoryItemId: string) => void;
  onRemoveInventoryItem: (inventoryItemId: string) => void;
}): JSX.Element {
  return (
    <section className="character-sheet__section">
      <h4>Equipment</h4>
      <p className="muted">
        Inventory uses GM-defined item classes.
      </p>
      {canEdit ? (
        <div className="equipment-add-row">
          <Field label="Item Template">
            <select
              value={selectedItemTemplateId}
              onChange={(event) => onSelectedItemTemplateIdChange(event.target.value)}
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
          <button className="button" onClick={onAddSelectedTemplate} disabled={!selectedItem}>
            Add
          </button>
        </div>
      ) : null}
      <p className="muted">Active Weapon: {activeWeaponLabel}</p>
      {canEdit && selectedItem ? (
        <article className="template-editor">
          <p className="template-editor__title">Selected Item Preview</p>
          <div className="muted">Weight {selectedItem.weight} · Price {selectedItem.price}</div>
          <p className="muted">{selectedItem.description || "(no description)"}</p>
          <p className="muted">Stat Augmentations: {describeAugmentations(selectedItem)}</p>
        </article>
      ) : null}
      <div className="list">
        {equipment.length === 0 ? <EmptyState message="No equipment added yet." /> : null}
        {equipment.map((entry) => {
          const item = items[entry.item_id];
          if (!item) {
            return null;
          }
          return (
            <article key={entry.relationship_id} className="list-item list-item--block">
              <div>
                <strong>{item.name}</strong>
                <div className="muted">Count {entry.count}</div>
                <div className="muted">Weight {item.weight} · Price {item.price}</div>
                <div className="muted">{item.description || "(no description)"}</div>
                <div className="muted">Stat Augmentations: {describeAugmentations(item)}</div>
                {activeWeaponId === entry.relationship_id ? <div className="muted">Active weapon</div> : null}
              </div>
              {canEdit ? (
                <div className="inline-actions">
                  <button
                    className="button button--secondary"
                    onClick={() => onToggleActiveWeapon(entry.relationship_id)}
                  >
                    {activeWeaponId === entry.relationship_id ? "Clear Active" : "Set Active"}
                  </button>
                  <button
                    className="button button--secondary"
                    onClick={() => onRemoveInventoryItem(entry.relationship_id)}
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
