import type { SigilPayload } from "@/generated/backendProtocol";
import { itemSigilNodes } from "@/features/sigils/sigilItemActions";
import { ItemSigilControls } from "@/features/sigils/ItemSigilControls";
import { useMemo, useState, type DragEvent } from "react";
import type {
  ActionDefinition,
  Augmentation,
  AttributeDefinition,
  ItemBridge,
  ItemDefinition,
  ProficiencyDefinition,
  StandaloneEffectDefinition
} from "@/domain/models";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Field } from "@/shared/ui/Field";
import { ModalDialog } from "@/shared/ui/ModalDialog";
import { confirmDestructiveAction } from "@/shared/ui/confirmDestructiveAction";
import {
  countItemEffectTypes,
  itemCarryStatus,
  ITEM_INTERACTION_LABELS,
  selectActiveEquipmentEffects,
  summarizeItemAttributeDetails,
  summarizeItemActionGrants
} from "@/features/sheets/equipmentDisplay";
import {
  eligibleContainerDestinations,
  filterRootInventoryBySearch,
  formatWeight,
  selectDirectContainerContents
} from "@/features/sheets/inventoryDisplay";
import { CatalogEntityPicker } from "@/features/catalogs/CatalogEntityPicker";
import { InventoryQuantityDialog } from "@/features/sheets/components/InventoryQuantityDialog";

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
  sigils = {},
  instanceId,
  sigilPending = false,
  onActivateSigil,
  onRechargeSigil,
  items,
  actionDefinitions,
  attributeDefinitions,
  proficiencyDefinitions,
  augmentations,
  effectDefinitions = {},
  itemOrder,
  selectedItemId,
  selectedItem,
  equipment,
  currentCarriedWeight,
  carryWeightLimit,
  canManageInventory,
  canEditInventory,
  canMoveInventory,
  canToggleEquipped,
  dense = false,
  inventoryRootId = null,
  embeddedContainer = false,
  onOpenContainerRequest,
  createItemLabel = "Create Item",
  onOpenCreateItem,
  onSelectedItemIdChange,
  onAddSelectedItem,
  onQuantityChange,
  onToggleEquipped,
  onMoveInventoryItem,
  onRemoveInventoryItem
}: {
  sigils?: Record<string, SigilPayload>;
  instanceId?: string;
  sigilPending?: boolean;
  onActivateSigil?: (sigilId: string, nodeId: string) => void;
  onRechargeSigil?: (sigilId: string, nodeId: string) => void;
  items: Record<string, ItemDefinition>;
  actionDefinitions: Record<string, ActionDefinition>;
  attributeDefinitions: Record<string, AttributeDefinition>;
  proficiencyDefinitions: Record<string, ProficiencyDefinition>;
  augmentations: Record<string, Augmentation>;
  effectDefinitions?: Record<string, StandaloneEffectDefinition>;
  itemOrder: string[];
  selectedItemId: string;
  selectedItem: ItemDefinition | null;
  equipment: ItemBridge[];
  currentCarriedWeight: number;
  carryWeightLimit: number;
  canManageInventory: boolean;
  canEditInventory: boolean;
  canMoveInventory: boolean;
  canToggleEquipped: boolean;
  dense?: boolean;
  inventoryRootId?: string | null;
  embeddedContainer?: boolean;
  onOpenContainerRequest?: (containerRelationshipId: string) => void;
  createItemLabel?: string;
  onOpenCreateItem?: () => void;
  onSelectedItemIdChange: (itemId: string) => void;
  onAddSelectedItem: () => void;
  onQuantityChange: (inventoryItemId: string, count: number) => void;
  onToggleEquipped: (inventoryItemId: string) => void;
  onMoveInventoryItem: (inventoryItemId: string, parentContainerId: string | null) => void;
  onRemoveInventoryItem: (inventoryItemId: string) => void;
}): JSX.Element {
  const overBy = Math.max(0, currentCarriedWeight - carryWeightLimit);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [containerPath, setContainerPath] = useState<string[]>([]);
  const [moveDialogInventoryItemId, setMoveDialogInventoryItemId] = useState<string | null>(null);
  const [quantityDialogInventoryItemId, setQuantityDialogInventoryItemId] = useState<string | null>(
    null
  );
  const [draggedInventoryItemId, setDraggedInventoryItemId] = useState<string | null>(null);
  const [activeDropTarget, setActiveDropTarget] = useState<string | null>(null);
  const eligibleDropTargetIds = useMemo(
    () =>
      new Set(
        draggedInventoryItemId
          ? eligibleContainerDestinations(draggedInventoryItemId, equipment, items).map(
              (entry) => entry.relationship_id
            )
          : []
      ),
    [draggedInventoryItemId, equipment, items]
  );
  const moveDialogEntry = moveDialogInventoryItemId
    ? equipment.find((entry) => entry.relationship_id === moveDialogInventoryItemId)
    : undefined;
  const moveDialogItem = moveDialogEntry ? items[moveDialogEntry.item_id] : undefined;
  const quantityDialogEntry = quantityDialogInventoryItemId
    ? equipment.find((entry) => entry.relationship_id === quantityDialogInventoryItemId)
    : undefined;
  const quantityDialogItem = quantityDialogEntry ? items[quantityDialogEntry.item_id] : undefined;
  const moveDialogDestinations = useMemo(
    () =>
      moveDialogInventoryItemId
        ? eligibleContainerDestinations(moveDialogInventoryItemId, equipment, items)
        : [],
    [equipment, items, moveDialogInventoryItemId]
  );
  const visibleInventory = useMemo(() => {
    if (inventoryRootId) {
      return selectDirectContainerContents(inventoryRootId, equipment);
    }
    return filterRootInventoryBySearch(equipment, items, search);
  }, [equipment, inventoryRootId, items, search]);
  const activeContainerId = containerPath.at(-1) ?? null;
  const activeContainerEntry = activeContainerId
    ? equipment.find((entry) => entry.relationship_id === activeContainerId)
    : undefined;
  const activeContainer = activeContainerEntry ? items[activeContainerEntry.item_id] : undefined;
  const openContainer = (containerRelationshipId: string): void => {
    if (onOpenContainerRequest) {
      onOpenContainerRequest(containerRelationshipId);
      return;
    }
    setContainerPath([containerRelationshipId]);
  };

  const finishDrag = (): void => {
    setDraggedInventoryItemId(null);
    setActiveDropTarget(null);
  };

  const moveDraggedItem = (
    event: DragEvent<HTMLElement>,
    parentContainerId: string | null
  ): void => {
    event.preventDefault();
    event.stopPropagation();
    const relationshipId =
      draggedInventoryItemId || event.dataTransfer.getData("application/x-ttrpg-inventory-item");
    if (!relationshipId) {
      finishDrag();
      return;
    }
    onMoveInventoryItem(relationshipId, parentContainerId);
    finishDrag();
  };

  const moveInventoryItem = (parentContainerId: string | null): void => {
    if (!moveDialogEntry || moveDialogEntry.parent_container_id === parentContainerId) {
      return;
    }
    onMoveInventoryItem(moveDialogEntry.relationship_id, parentContainerId);
    setMoveDialogInventoryItemId(null);
  };

  const addSelectedItem = (): void => {
    if (!selectedItem) {
      return;
    }
    onAddSelectedItem();
    setAddDialogOpen(false);
  };

  return (
    <section
      className={`character-sheet__section sheet-equipment-section ${dense ? "sheet-equipment-section--dense" : ""} ${embeddedContainer ? "sheet-equipment-section--embedded" : ""}`}
    >
      {!embeddedContainer ? (
        <div className="equipment-section__heading">
          <div className="equipment-section__heading-copy">
            <h4>Inventory &amp; Equipment</h4>
            {!dense ? (
              <span className="muted">
                {equipment.length} {equipment.length === 1 ? "entry" : "entries"}
              </span>
            ) : null}
          </div>
          {dense ? (
            <div className="equipment-search">
              <input
                type="search"
                value={search}
                aria-label="Search inventory"
                placeholder="Find equipment, consumables, or carried items"
                onChange={(event) => setSearch(event.target.value)}
              />
              <span className="muted">
                {equipment.length} {equipment.length === 1 ? "entry" : "entries"}
              </span>
            </div>
          ) : null}
          <div className="equipment-section__heading-actions">
            <div
              className={`carried-weight-summary ${overBy > 0 ? "carried-weight-summary--over" : ""}`}
              role="status"
            >
              <strong>
                Carried Weight: {formatWeight(currentCarriedWeight)} /{" "}
                {formatWeight(carryWeightLimit)} lb
              </strong>
              {overBy > 0 ? <span>{formatWeight(overBy)} lb over capacity</span> : null}
            </div>
            {canManageInventory ? (
              <div className="inline-actions">
                <button
                  type="button"
                  className="button button--secondary"
                  aria-haspopup="dialog"
                  aria-expanded={addDialogOpen}
                  onClick={() => setAddDialogOpen(true)}
                >
                  Add Existing
                </button>
                {onOpenCreateItem ? (
                  <button
                    type="button"
                    className="button"
                    aria-haspopup="dialog"
                    onClick={onOpenCreateItem}
                  >
                    {createItemLabel}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {!dense && !embeddedContainer ? (
        <div className="equipment-search">
          <Field label="Search inventory">
            <input
              type="search"
              value={search}
              placeholder="Find equipment, consumables, or carried items"
              onChange={(event) => setSearch(event.target.value)}
            />
          </Field>
        </div>
      ) : null}
      <div
        className="equipment-grid sheet-equipment-section__items"
        role="region"
        aria-label="Owned inventory items"
        tabIndex={0}
      >
        {visibleInventory.length === 0 && !search.trim() ? (
          <EmptyState
            message={inventoryRootId ? "This container is empty." : "No inventory items."}
          />
        ) : null}
        {visibleInventory.length === 0 && search.trim() ? (
          <EmptyState message="No inventory items match the current search." />
        ) : null}
        {visibleInventory.map((entry) => {
          const item = items[entry.item_id];
          if (!item) {
            return null;
          }
          const actionSummaries = summarizeItemActionGrants(item, entry, actionDefinitions);
          const sigilEntries = instanceId
            ? itemSigilNodes(sigils, instanceId, entry.relationship_id)
            : [];
          const actionCount =
            actionSummaries.length +
            (entry.count === 1
              ? sigilEntries.filter(
                  ({ node }) => node.charge && node.action_id && actionDefinitions[node.action_id]
                ).length
              : 0);
          const activeEffects = selectActiveEquipmentEffects(augmentations, entry.relationship_id);
          const effectCounts = countItemEffectTypes(item, effectDefinitions);
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
          const storageCapacity = item.storage_capacity_weight;
          const storedWeight = entry.current_contents_weight ?? 0;
          const directContentCount = selectDirectContainerContents(
            entry.relationship_id,
            equipment
          ).length;
          const storageOverBy =
            storageCapacity == null ? 0 : Math.max(0, storedWeight - storageCapacity);
          const isEligibleDropTarget = eligibleDropTargetIds.has(entry.relationship_id);
          const canDragEntry =
            canMoveInventory &&
            !entry.equipped &&
            (Boolean(entry.parent_container_id) || destinations.length > 0);
          return (
            <article
              key={entry.relationship_id}
              className={[
                "list-item",
                "list-item--block",
                "equipment-card",
                "equipment-card--owned",
                entry.count <= 0 ? "equipment-card--depleted" : "",
                draggedInventoryItemId === entry.relationship_id ? "equipment-card--dragging" : "",
                activeDropTarget === entry.relationship_id ? "inventory-drop-target--active" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              tabIndex={0}
              draggable={canDragEntry}
              onDragStart={(event) => {
                if (!canDragEntry) {
                  event.preventDefault();
                  return;
                }
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData(
                  "application/x-ttrpg-inventory-item",
                  entry.relationship_id
                );
                setDraggedInventoryItemId(entry.relationship_id);
              }}
              onDragEnd={finishDrag}
              onDragEnter={(event) => {
                if (isEligibleDropTarget) {
                  event.preventDefault();
                  event.stopPropagation();
                  setActiveDropTarget(entry.relationship_id);
                }
              }}
              onDragOver={(event) => {
                if (isEligibleDropTarget) {
                  event.preventDefault();
                  event.stopPropagation();
                  event.dataTransfer.dropEffect = "move";
                }
              }}
              onDragLeave={() =>
                setActiveDropTarget((current) =>
                  current === entry.relationship_id ? null : current
                )
              }
              onDrop={(event) => {
                if (isEligibleDropTarget) {
                  moveDraggedItem(event, entry.relationship_id);
                }
              }}
            >
              <div className="equipment-card__body">
                <div className="equipment-card__heading">
                  <strong>{item.name}</strong>
                  <span className="equipment-card__quantity" aria-label={`Quantity ${entry.count}`}>
                    ×{entry.count}
                  </span>
                </div>
                <div className="equipment-card__status">
                  <span className="pill">{ITEM_INTERACTION_LABELS[item.interaction_type]}</span>
                  <span className={`pill ${entry.equipped ? "pill--connected" : ""}`}>
                    {itemCarryStatus(item, entry)}
                  </span>
                </div>
                {parentItem ? (
                  <div className="equipment-card__containment">
                    Stored in {parentItem.name} · Contents weight{" "}
                    {parentItem.contents_weight_behavior === "ignored" ? "ignored" : "counts"}
                  </div>
                ) : null}
                {item.can_contain_items ? (
                  <div
                    className={`equipment-storage-summary ${
                      storageOverBy > 0 ? "equipment-storage-summary--over" : ""
                    }`}
                  >
                    <div>
                      <strong>
                        Stored weight: {formatWeight(storedWeight)} /{" "}
                        {storageCapacity == null
                          ? "Unlimited"
                          : `${formatWeight(storageCapacity)} lb`}
                      </strong>
                      <span>
                        {item.contents_weight_behavior === "ignored"
                          ? "Stored contents do not add to carried weight."
                          : "Stored contents add to carried weight normally."}
                      </span>
                    </div>
                    {storageCapacity != null ? (
                      <progress
                        max={Math.max(storageCapacity, 1)}
                        value={Math.min(storedWeight, Math.max(storageCapacity, 1))}
                        aria-label={`${item.name} storage capacity`}
                      />
                    ) : null}
                    {storageOverBy > 0 ? (
                      <span>{formatWeight(storageOverBy)} lb over capacity</span>
                    ) : null}
                    <div className="equipment-storage-summary__actions">
                      <span>
                        {directContentCount} direct {directContentCount === 1 ? "item" : "items"}
                      </span>
                      <button
                        type="button"
                        className="button button--secondary"
                        aria-haspopup="dialog"
                        onClick={() => openContainer(entry.relationship_id)}
                      >
                        View Inside
                      </button>
                    </div>
                  </div>
                ) : null}
                <div className="equipment-card__meta muted">
                  <span>{formatWeight(item.weight)} lb</span>
                  <span>{item.price ? `${item.price}` : "Price unavailable"}</span>
                </div>
                {actionCount || totalEffectCount || attributeCount ? (
                  <div className="equipment-card__compact-stats muted">
                    {actionCount ? (
                      <span>
                        {actionCount} {actionCount === 1 ? "action" : "actions"}
                      </span>
                    ) : null}
                    {totalEffectCount ? (
                      <span>
                        {totalEffectCount} {totalEffectCount === 1 ? "effect" : "effects"}
                      </span>
                    ) : null}
                    {attributeCount ? (
                      <span>
                        {attributeCount} {attributeCount === 1 ? "attribute" : "attributes"}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <ItemDetailHoverLabel
                  description={item.description}
                  attributeSummaries={attributeSummaries}
                  effectCounts={effectCounts}
                  activeEffects={activeEffects}
                  actionSummaries={actionSummaries}
                />
              </div>
              {instanceId && (
                <ItemSigilControls
                  entries={sigilEntries}
                  actions={actionDefinitions}
                  available={entry.count === 1}
                  pending={sigilPending}
                  onActivate={onActivateSigil}
                  onRecharge={onRechargeSigil}
                />
              )}
              {canManageInventory ||
              canEditInventory ||
              canMoveInventory ||
              canToggleEquipped ||
              (dense && item.can_contain_items) ? (
                <div className="equipment-card__controls">
                  <div className="equipment-card__control-row">
                    {canEditInventory ? (
                      <div className="equipment-card__quantity-control">
                        <span>Qty</span>
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
                            −
                          </button>
                          <button
                            type="button"
                            className="equipment-quantity-stepper__value"
                            title={`Adjust ${item.name} quantity in bulk`}
                            aria-label={`${item.name} quantity value: ${entry.count}. Adjust in bulk`}
                            aria-haspopup="dialog"
                            onClick={() => setQuantityDialogInventoryItemId(entry.relationship_id)}
                          >
                            {entry.count}
                          </button>
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
                      </div>
                    ) : null}
                    <div className="equipment-card__actions">
                      {canMoveInventory &&
                      (Boolean(entry.parent_container_id) || destinations.length > 0) ? (
                        <button
                          type="button"
                          className="button button--secondary equipment-card__move"
                          disabled={entry.equipped}
                          title={entry.equipped ? "Unequip before moving this item" : undefined}
                          aria-label={`Move ${item.name}`}
                          aria-haspopup="dialog"
                          onClick={() => setMoveDialogInventoryItemId(entry.relationship_id)}
                        >
                          Move
                        </button>
                      ) : null}
                      {dense && item.can_contain_items ? (
                        <button
                          type="button"
                          className="button button--secondary equipment-card__view-inside"
                          title={`View inside ${item.name}`}
                          aria-label={`View inside ${item.name}`}
                          aria-haspopup="dialog"
                          onClick={() => openContainer(entry.relationship_id)}
                        >
                          View Inside
                        </button>
                      ) : null}
                      {canToggleEquipped && item.interaction_type === "equippable" ? (
                        <button
                          type="button"
                          className={`button equipment-card__toggle-equipped ${entry.equipped ? "" : "button--secondary"}`}
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
                          className="button button--secondary equipment-card__remove"
                          onClick={() => {
                            if (
                              !confirmDestructiveAction({
                                action: "Remove",
                                subject: item.name,
                                consequence:
                                  "This removes the inventory entry and its quantity from the selected character. Nonempty storage containers are still protected by backend validation."
                              })
                            ) {
                              return;
                            }
                            onRemoveInventoryItem(entry.relationship_id);
                          }}
                          aria-label={`Remove ${item.name} from inventory`}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      {!embeddedContainer && activeContainerEntry && activeContainer ? (
        <ModalDialog
          title={`Inside ${activeContainer.name}`}
          description={`Showing items stored directly inside ${activeContainer.name}. Nested containers open in this same view.`}
          size="large"
          dialogClassName="inventory-container-dialog"
          onClose={() => setContainerPath([])}
        >
          <div className="inventory-container-dialog__navigation">
            <div className="inventory-container-dialog__path" aria-label="Container path">
              {containerPath.map((relationshipId, index) => {
                const pathEntry = equipment.find(
                  (entry) => entry.relationship_id === relationshipId
                );
                const pathItem = pathEntry ? items[pathEntry.item_id] : undefined;
                return (
                  <span key={relationshipId}>
                    {index > 0 ? " / " : ""}
                    {pathItem?.name ?? "Missing container"}
                  </span>
                );
              })}
            </div>
            {containerPath.length > 1 ? (
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setContainerPath((current) => current.slice(0, -1))}
              >
                Back
              </button>
            ) : null}
          </div>
          <SheetEquipmentSection
            sigils={sigils}
            instanceId={instanceId}
            sigilPending={sigilPending}
            onActivateSigil={onActivateSigil}
            onRechargeSigil={onRechargeSigil}
            items={items}
            actionDefinitions={actionDefinitions}
            attributeDefinitions={attributeDefinitions}
            proficiencyDefinitions={proficiencyDefinitions}
            augmentations={augmentations}
            effectDefinitions={effectDefinitions}
            itemOrder={itemOrder}
            selectedItemId={selectedItemId}
            selectedItem={selectedItem}
            equipment={equipment}
            currentCarriedWeight={currentCarriedWeight}
            carryWeightLimit={carryWeightLimit}
            canManageInventory={canManageInventory}
            canEditInventory={canEditInventory}
            canMoveInventory={canMoveInventory}
            canToggleEquipped={canToggleEquipped}
            dense={dense}
            inventoryRootId={activeContainerId}
            embeddedContainer
            onOpenContainerRequest={(containerRelationshipId) =>
              setContainerPath((current) => [...current, containerRelationshipId])
            }
            onSelectedItemIdChange={onSelectedItemIdChange}
            onAddSelectedItem={onAddSelectedItem}
            onQuantityChange={onQuantityChange}
            onToggleEquipped={onToggleEquipped}
            onMoveInventoryItem={onMoveInventoryItem}
            onRemoveInventoryItem={onRemoveInventoryItem}
          />
        </ModalDialog>
      ) : null}
      {quantityDialogEntry && quantityDialogItem ? (
        <InventoryQuantityDialog
          itemName={quantityDialogItem.name}
          currentCount={quantityDialogEntry.count}
          onChange={(count) => onQuantityChange(quantityDialogEntry.relationship_id, count)}
          onClose={() => setQuantityDialogInventoryItemId(null)}
        />
      ) : null}
      {canMoveInventory && moveDialogEntry && moveDialogItem ? (
        <ModalDialog
          title={`Move ${moveDialogItem.name}`}
          description="Choose where this item should be stored. Its current location is unavailable."
          onClose={() => setMoveDialogInventoryItemId(null)}
        >
          <div className="inventory-move-dialog__destinations">
            <button
              type="button"
              className="button button--secondary inventory-move-dialog__destination"
              disabled={!moveDialogEntry.parent_container_id}
              onClick={() => moveInventoryItem(null)}
            >
              <strong>Root Inventory</strong>
              <span>
                {moveDialogEntry.parent_container_id
                  ? "Store outside of all containers"
                  : "Current location"}
              </span>
            </button>
            {moveDialogDestinations.map((destination) => {
              const destinationItem = items[destination.item_id];
              const isCurrentLocation =
                moveDialogEntry.parent_container_id === destination.relationship_id;
              return (
                <button
                  key={destination.relationship_id}
                  type="button"
                  className="button button--secondary inventory-move-dialog__destination"
                  disabled={isCurrentLocation}
                  onClick={() => moveInventoryItem(destination.relationship_id)}
                >
                  <strong>{destinationItem?.name ?? destination.item_id}</strong>
                  <span>{isCurrentLocation ? "Current location" : "Move into this container"}</span>
                </button>
              );
            })}
          </div>
        </ModalDialog>
      ) : null}
      {canManageInventory && addDialogOpen ? (
        <ModalDialog
          title="Add existing Item"
          description="Choose a reusable Item from the catalog and add one copy to this character."
          onClose={() => setAddDialogOpen(false)}
        >
          <div className="stack equipment-add-dialog">
            <CatalogEntityPicker
              catalog="items"
              label="Item"
              placeholder="Search Item catalog"
              selectedId={selectedItemId}
              options={itemOrder.flatMap((itemId) => {
                const item = items[itemId];
                return item
                  ? [
                      {
                        id: item.id,
                        label: item.name,
                        secondary: item.description,
                        keywords: [item.id, item.rank ?? ""],
                        value: item.id
                      }
                    ]
                  : [];
              })}
              emptyMessage="No Items are available to add."
              onSelect={onSelectedItemIdChange}
            />
            {selectedItem
              ? (() => {
                  const selectedEffectCounts = countItemEffectTypes(
                    selectedItem,
                    effectDefinitions
                  );
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
            <div className="inline-actions">
              <button
                type="button"
                className="button"
                onClick={addSelectedItem}
                disabled={!selectedItem}
              >
                Add Item
              </button>
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setAddDialogOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </ModalDialog>
      ) : null}
    </section>
  );
}
