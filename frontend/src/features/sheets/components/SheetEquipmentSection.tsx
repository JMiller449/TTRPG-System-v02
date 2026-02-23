import type { ItemTemplate, SheetInventoryItem } from "@/domain/models";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Field } from "@/shared/ui/Field";

export function SheetEquipmentSection({
  itemTemplates,
  itemTemplateOrder,
  selectedItemTemplateId,
  selectedTemplate,
  activeWeaponLabel,
  equipment,
  activeWeaponId,
  onSelectedItemTemplateIdChange,
  onAddSelectedTemplate,
  onToggleActiveWeapon,
  onRemoveInventoryItem
}: {
  itemTemplates: Record<string, ItemTemplate>;
  itemTemplateOrder: string[];
  selectedItemTemplateId: string;
  selectedTemplate: ItemTemplate | null;
  activeWeaponLabel: string;
  equipment: SheetInventoryItem[];
  activeWeaponId: string | null;
  onSelectedItemTemplateIdChange: (itemTemplateId: string) => void;
  onAddSelectedTemplate: () => void;
  onToggleActiveWeapon: (inventoryItemId: string) => void;
  onRemoveInventoryItem: (inventoryItemId: string) => void;
}): JSX.Element {
  return (
    <section className="character-sheet__section">
      <h4>Equipment</h4>
      <p className="muted">
        Inventory uses GM-defined item classes. Effects are display-only in frontend scaffolding.
      </p>
      <div className="equipment-add-row">
        <Field label="Item Template">
          <select
            value={selectedItemTemplateId}
            onChange={(event) => onSelectedItemTemplateIdChange(event.target.value)}
          >
            {itemTemplateOrder.length === 0 ? <option value="">No items created yet</option> : null}
            {itemTemplateOrder.map((itemId) => {
              const item = itemTemplates[itemId];
              if (!item) {
                return null;
              }
              return (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.type})
                </option>
              );
            })}
          </select>
        </Field>
        <button className="button" onClick={onAddSelectedTemplate} disabled={!selectedTemplate}>
          Add
        </button>
      </div>
      <p className="muted">Active Weapon: {activeWeaponLabel}</p>
      {selectedTemplate ? (
        <article className="template-editor">
          <p className="template-editor__title">Selected Item Preview</p>
          <div className="muted">
            {selectedTemplate.type} · Rank {selectedTemplate.rank} · Weight {selectedTemplate.weight} · Value{" "}
            {selectedTemplate.value}
          </div>
          <p className="muted">Immediate Effects: {selectedTemplate.immediateEffects || "(none)"}</p>
          <p className="muted">Non-Immediate Effects: {selectedTemplate.nonImmediateEffects || "(none)"}</p>
        </article>
      ) : null}
      <div className="list">
        {equipment.length === 0 ? <EmptyState message="No equipment added yet." /> : null}
        {equipment.map((entry) => {
          const item = itemTemplates[entry.itemTemplateId];
          if (!item) {
            return null;
          }
          return (
            <article key={entry.id} className="list-item list-item--block">
              <div>
                <strong>{item.name}</strong>
                <div className="muted">
                  {item.type} · Rank {item.rank} · Weight {item.weight} · Value {item.value}
                </div>
                <div className="muted">Immediate Effects: {item.immediateEffects || "(none)"}</div>
                <div className="muted">Non-Immediate Effects: {item.nonImmediateEffects || "(none)"}</div>
                {activeWeaponId === entry.id ? <div className="muted">Active weapon</div> : null}
              </div>
              <div className="inline-actions">
                <button className="button button--secondary" onClick={() => onToggleActiveWeapon(entry.id)}>
                  {activeWeaponId === entry.id ? "Clear Active" : "Set Active"}
                </button>
                <button className="button button--secondary" onClick={() => onRemoveInventoryItem(entry.id)}>
                  Remove
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
