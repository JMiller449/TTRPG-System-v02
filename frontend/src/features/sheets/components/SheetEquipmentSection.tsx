import type {
  ActionDefinition,
  Augmentation,
  AttributeDefinition,
  ItemBridge,
  ItemDefinition,
  ProficiencyDefinition
} from "@/domain/models";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Field } from "@/shared/ui/Field";
import {
  countItemEffectTypes,
  itemCarryStatus,
  ITEM_INTERACTION_LABELS,
  selectActiveEquipmentEffects,
  summarizeItemAttributeDetails,
  summarizeItemActionGrants
} from "@/features/sheets/equipmentDisplay";
import {
  buildInventoryTree,
  eligibleContainerDestinations,
  formatWeight
} from "@/features/sheets/inventoryDisplay";

function ItemDetailHoverLabel({
  description,
  attributeSummaries,
  effectCounts,
  activeEffects,
  actionSummaries,
  actionNames
}: {
  description: string;
  attributeSummaries: string[];
  effectCounts: ReturnType<typeof countItemEffectTypes>;
  activeEffects: Augmentation[];
  actionSummaries?: ReturnType<typeof summarizeItemActionGrants>;
  actionNames?: string[];
}): JSX.Element | null {
  const totalEffectCount = effectCounts.wearer + effectCounts.rollOrFormula + activeEffects.length;
  const hasActions = Boolean(actionSummaries?.length || actionNames?.length);

  if (!description && attributeSummaries.length === 0 && totalEffectCount === 0 && !hasActions) {
    return null;
  }

  return (
    <div className="equipment-card__hover-label" role="tooltip">
      {description ? <p>{description}</p> : null}
      {attributeSummaries.length > 0 ? (
        <div className="equipment-card__tooltip-grid">
          {attributeSummaries.map((summary) => (
            <span key={summary}>{summary}</span>
          ))}
        </div>
      ) : null}
      {totalEffectCount > 0 ? (
        <div>
          Effects: wearer {effectCounts.wearer}, roll/formula {effectCounts.rollOrFormula}, active{" "}
          {activeEffects.length}
        </div>
      ) : null}
      {activeEffects.length > 0 ? (
        <div>Active: {activeEffects.map((augmentation) => augmentation.name).join(", ")}</div>
      ) : null}
      {actionSummaries?.length ? (
        <div className="equipment-card__tooltip-actions">
          {actionSummaries.map((summary) => (
            <span key={summary.actionId}>
              {summary.actionName}: {summary.availability}, {summary.status}
            </span>
          ))}
        </div>
      ) : null}
      {actionNames?.length ? <div>Actions: {actionNames.join(", ")}</div> : null}
    </div>
  );
}

export function SheetEquipmentSection({
  items,
  actionDefinitions,
  attributeDefinitions,
  proficiencyDefinitions,
  augmentations,
  itemOrder,
  selectedItemId,
  selectedItem,
  equipment,
  currentCarriedWeight,
  carryWeightLimit,
  canManageInventory,
  canEditInventory,
  canToggleEquipped,
  onSelectedItemIdChange,
  onAddSelectedItem,
  onQuantityChange,
  onToggleEquipped,
  onMoveInventoryItem,
  onRemoveInventoryItem
}: {
  items: Record<string, ItemDefinition>;
  actionDefinitions: Record<string, ActionDefinition>;
  attributeDefinitions: Record<string, AttributeDefinition>;
  proficiencyDefinitions: Record<string, ProficiencyDefinition>;
  augmentations: Record<string, Augmentation>;
  itemOrder: string[];
  selectedItemId: string;
  selectedItem: ItemDefinition | null;
  equipment: ItemBridge[];
  currentCarriedWeight: number;
  carryWeightLimit: number;
  canManageInventory: boolean;
  canEditInventory: boolean;
  canToggleEquipped: boolean;
  onSelectedItemIdChange: (itemId: string) => void;
  onAddSelectedItem: () => void;
  onQuantityChange: (inventoryItemId: string, count: number) => void;
  onToggleEquipped: (inventoryItemId: string) => void;
  onMoveInventoryItem: (inventoryItemId: string, parentContainerId: string | null) => void;
  onRemoveInventoryItem: (inventoryItemId: string) => void;
}): JSX.Element {
  const overBy = Math.max(0, currentCarriedWeight - carryWeightLimit);
  return (
    <section className="character-sheet__section sheet-equipment-section">
      <div className="equipment-section__heading">
        <h4>Inventory &amp; Equipment</h4>
        <div
          className={`carried-weight-summary ${overBy > 0 ? "carried-weight-summary--over" : ""}`}
          role="status"
        >
          <strong>
            Carried Weight: {formatWeight(currentCarriedWeight)} / {formatWeight(carryWeightLimit)}{" "}
            lb
          </strong>
          {overBy > 0 ? <span>{formatWeight(overBy)} lb over capacity</span> : null}
        </div>
      </div>
      {canManageInventory ? (
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
      {canManageInventory && selectedItem
        ? (() => {
            const selectedEffectCounts = countItemEffectTypes(selectedItem);
            const selectedAttributeSummaries = summarizeItemAttributeDetails(
              selectedItem,
              attributeDefinitions,
              proficiencyDefinitions
            );
            const selectedActionNames = (selectedItem.action_grants ?? []).map(
              (grant) => actionDefinitions[grant.action_id]?.name ?? grant.action_id
            );
            const selectedEffectTotal =
              selectedEffectCounts.wearer + selectedEffectCounts.rollOrFormula;
            const selectedAttributeCount = Object.keys(selectedItem.attributes ?? {}).length;

            return (
              <div className="equipment-selection-preview equipment-card" tabIndex={0}>
                <div className="equipment-card__heading">
                  <strong>{selectedItem.name}</strong>
                  <span className="pill">
                    {ITEM_INTERACTION_LABELS[selectedItem.interaction_type]}
                  </span>
                </div>
                <div className="muted">
                  Weight {formatWeight(selectedItem.weight)} lb · Price {selectedItem.price}
                </div>
                <div className="equipment-card__compact-stats muted">
                  <span>Actions {selectedActionNames.length}</span>
                  <span>Effects {selectedEffectTotal}</span>
                  <span>Attributes {selectedAttributeCount}</span>
                </div>
                <ItemDetailHoverLabel
                  description={selectedItem.description}
                  attributeSummaries={selectedAttributeSummaries}
                  effectCounts={selectedEffectCounts}
                  activeEffects={[]}
                  actionNames={selectedActionNames}
                />
              </div>
            );
          })()
        : null}
      <div
        className="list sheet-equipment-section__items"
        role="region"
        aria-label="Owned inventory items"
        tabIndex={0}
      >
        {equipment.length === 0 ? <EmptyState message="No inventory items." /> : null}
        {buildInventoryTree(equipment).map(({ bridge: entry, depth }) => {
          const item = items[entry.item_id];
          if (!item) {
            return null;
          }
          const actionSummaries = summarizeItemActionGrants(item, entry, actionDefinitions);
          const activeEffects = selectActiveEquipmentEffects(augmentations, entry.relationship_id);
          const effectCounts = countItemEffectTypes(item);
          const attributeSummaries = summarizeItemAttributeDetails(
            item,
            attributeDefinitions,
            proficiencyDefinitions
          );
          const totalEffectCount =
            effectCounts.wearer + effectCounts.rollOrFormula + activeEffects.length;
          const attributeCount = Object.keys(item.attributes ?? {}).length;
          const parentEntry = entry.parent_container_id
            ? equipment.find((candidate) => candidate.relationship_id === entry.parent_container_id)
            : undefined;
          const parentItem = parentEntry ? items[parentEntry.item_id] : undefined;
          const destinations = eligibleContainerDestinations(
            entry.relationship_id,
            equipment,
            items
          );
          return (
            <article
              key={entry.relationship_id}
              className={`list-item list-item--block equipment-card ${entry.count <= 0 ? "equipment-card--depleted" : ""}`}
              tabIndex={0}
              style={{ paddingInlineStart: `${0.75 + Math.min(depth, 6) * 1.1}rem` }}
            >
              <div className="equipment-card__body">
                <div className="equipment-card__heading">
                  <strong>{item.name}</strong>
                  <div className="equipment-card__status">
                    <span className="pill">{ITEM_INTERACTION_LABELS[item.interaction_type]}</span>
                    <span className="pill">{itemCarryStatus(item, entry)}</span>
                    <span className="pill">Quantity {entry.count}</span>
                    {item.can_contain_items ? (
                      <span className="pill">
                        Storage ·{" "}
                        {item.contents_weight_behavior === "ignored"
                          ? "contents weight ignored"
                          : "contents weight counts"}
                      </span>
                    ) : null}
                  </div>
                </div>
                {parentItem ? (
                  <div className="equipment-card__containment">
                    Stored in {parentItem.name} · Contents weight{" "}
                    {parentItem.contents_weight_behavior === "ignored" ? "ignored" : "counts"}
                  </div>
                ) : null}
                <div className="muted">
                  Weight {formatWeight(item.weight)} lb · Price {item.price}
                </div>
                <div className="equipment-card__compact-stats muted">
                  <span>Actions {actionSummaries.length}</span>
                  <span>Effects {totalEffectCount}</span>
                  <span>Attributes {attributeCount}</span>
                </div>
                <ItemDetailHoverLabel
                  description={item.description}
                  attributeSummaries={attributeSummaries}
                  effectCounts={effectCounts}
                  activeEffects={activeEffects}
                  actionSummaries={actionSummaries}
                />
              </div>
              {canManageInventory || canEditInventory || canToggleEquipped ? (
                <div className="inline-actions">
                  {canEditInventory ? (
                    <Field label={`Storage location for ${item.name}`}>
                      <select
                        value={entry.parent_container_id ?? ""}
                        disabled={entry.equipped}
                        aria-describedby={
                          entry.equipped ? `${entry.relationship_id}-storage-hint` : undefined
                        }
                        onChange={(event) =>
                          onMoveInventoryItem(entry.relationship_id, event.target.value || null)
                        }
                      >
                        <option value="">Root inventory</option>
                        {destinations.map((destination) => (
                          <option
                            key={destination.relationship_id}
                            value={destination.relationship_id}
                          >
                            {items[destination.item_id]?.name ?? destination.item_id}
                          </option>
                        ))}
                      </select>
                      {entry.equipped ? (
                        <span className="muted" id={`${entry.relationship_id}-storage-hint`}>
                          Unequip before moving into storage.
                        </span>
                      ) : null}
                    </Field>
                  ) : null}
                  {canEditInventory ? (
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
                  ) : null}
                  {canToggleEquipped && item.interaction_type === "equippable" ? (
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
                  {canManageInventory ? (
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={() => onRemoveInventoryItem(entry.relationship_id)}
                      aria-label={`Remove ${item.name} from inventory`}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
