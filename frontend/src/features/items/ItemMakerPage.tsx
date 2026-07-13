import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import { buildLoadActionFormulaAuthoringMetadataSubmission } from "@/features/actions/actionAuthoringRequests";
import type { GameClient } from "@/hooks/useGameClient";
import { ItemAugmentationTemplatePanel } from "@/features/augmentations/components/ItemAugmentationTemplatePanel";
import {
  createEmptyAugmentationEditorValues,
  hasValidAugmentationEditorValues,
  isKnownAugmentationEditorTarget,
  toAugmentationEditorValues,
  toItemAugmentationTemplatePayload,
  type AugmentationEditorValues
} from "@/features/augmentations/augmentationEditorValues";
import { buildAugmentationSelectorOptions } from "@/features/augmentations/augmentationSelectorOptions";
import { buildLoadItemAugmentationTargetMetadataSubmission } from "@/features/augmentations/augmentationRequests";
import { ItemEditorForm } from "@/features/items/components/ItemEditorForm";
import { ItemAttributesEditor } from "@/features/items/components/ItemAttributesEditor";
import {
  createEmptyItemValues,
  toItemEditorValues,
  type ItemEditorValues
} from "@/features/items/itemEditorValues";
import {
  buildCreateItemSubmission,
  buildDeleteItemSubmission,
  buildUpdateItemSubmission,
  selectOrderedItemDefinitions
} from "@/features/items/itemMakerRequests";
import { buildReviewPlayerItemRequest } from "@/infrastructure/ws/requestBuilders";
import { Panel } from "@/shared/ui/Panel";
import { CatalogEditorLayout } from "@/shared/ui/CatalogEditorLayout";
import { CatalogTileGrid } from "@/shared/ui/CatalogTileGrid";
import { makeId } from "@/shared/utils/id";

export function ItemMakerPage({ client }: { client: GameClient }): JSX.Element {
  const {
    state: {
      serverState: {
        items: itemRecords,
        itemOrder,
        actions: actionRecords,
        actionOrder,
        formulas: formulaRecords,
        formulaOrder,
        attributes: attributeDefinitions,
        proficiencies: proficiencyRecords
      },
      uiState: { augmentationTargetMetadata, actionFormulaAuthoringMetadata }
    },
    dispatch
  } = useAppStore();
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [draftItemId, setDraftItemId] = useState(() => makeId("item"));
  const [submittedCreateId, setSubmittedCreateId] = useState<string | null>(null);
  const [values, setValues] = useState<ItemEditorValues>(createEmptyItemValues);
  const [editingAugmentationId, setEditingAugmentationId] = useState<string | null>(null);
  const [augmentationValues, setAugmentationValues] = useState<AugmentationEditorValues>(
    createEmptyAugmentationEditorValues
  );
  const requestedFormulaMetadataRef = useRef(false);

  const items = useMemo(
    () =>
      selectOrderedItemDefinitions(itemRecords, itemOrder).filter(
        (item) => item.approval_status !== "pending"
      ),
    [itemOrder, itemRecords]
  );
  const pendingPlayerItems = useMemo(
    () =>
      selectOrderedItemDefinitions(itemRecords, itemOrder).filter(
        (item) => item.approval_status === "pending"
      ),
    [itemOrder, itemRecords]
  );
  const actions = useMemo(
    () => actionOrder.map((id) => actionRecords[id]).filter(Boolean),
    [actionOrder, actionRecords]
  );
  const selectorOptions = useMemo(
    () =>
      buildAugmentationSelectorOptions({
        actionRecords,
        actionOrder,
        formulaRecords,
        formulaOrder
      }),
    [actionOrder, actionRecords, formulaOrder, formulaRecords]
  );
  const targetOptions =
    augmentationTargetMetadata?.context === "item_template"
      ? augmentationTargetMetadata.targets
      : [];

  useEffect(() => {
    if (augmentationTargetMetadata?.context === "item_template") {
      return;
    }

    const submission = buildLoadItemAugmentationTargetMetadataSubmission();
    client.sendProtocolRequest(submission.request, submission.label);
  }, [augmentationTargetMetadata?.context, client]);

  useEffect(() => {
    if (actionFormulaAuthoringMetadata || requestedFormulaMetadataRef.current) {
      return;
    }
    requestedFormulaMetadataRef.current = true;
    const submission = buildLoadActionFormulaAuthoringMetadataSubmission();
    client.sendProtocolRequest(submission.request, submission.label);
  }, [actionFormulaAuthoringMetadata, client]);

  const resetAugmentationEditor = (): void => {
    setEditingAugmentationId(null);
    setAugmentationValues(createEmptyAugmentationEditorValues());
  };

  const startNewItem = (): void => {
    setEditingItemId(null);
    setDraftItemId(makeId("item"));
    setSubmittedCreateId(null);
    setValues(createEmptyItemValues());
    resetAugmentationEditor();
  };

  useEffect(() => {
    if (submittedCreateId && itemRecords[submittedCreateId]) {
      setEditingItemId(null);
      setDraftItemId(makeId("item"));
      setSubmittedCreateId(null);
      setValues(createEmptyItemValues());
      setEditingAugmentationId(null);
      setAugmentationValues(createEmptyAugmentationEditorValues());
    }
  }, [itemRecords, submittedCreateId]);

  const onSubmit = (): void => {
    if (!values.name.trim()) {
      return;
    }

    const validationContext = {
      definitions: attributeDefinitions,
      proficiencies: proficiencyRecords
    };
    const submission = editingItemId
      ? buildUpdateItemSubmission(itemRecords[editingItemId], values, validationContext)
      : buildCreateItemSubmission(values, draftItemId, validationContext);
    if (!submission) {
      return;
    }

    client.sendProtocolRequest(submission.request, submission.label);
    if (!editingItemId) {
      setSubmittedCreateId(draftItemId);
    }
  };

  const deleteItem = (itemId: string): void => {
    const submission = buildDeleteItemSubmission(itemId, itemRecords[itemId]);
    client.sendProtocolRequest(submission.request, submission.label);
    if (editingItemId === itemId) {
      startNewItem();
    }
  };

  const submitAugmentation = (): void => {
    if (
      !hasValidAugmentationEditorValues(augmentationValues) ||
      !isKnownAugmentationEditorTarget(augmentationValues, targetOptions)
    ) {
      return;
    }

    const augmentation = toItemAugmentationTemplatePayload({
      values: augmentationValues,
      augmentationId: editingAugmentationId ?? makeId("augmentation"),
      itemId: editingItemId ?? "draft-item",
      itemName: values.name
    });
    setValues((current) => ({
      ...current,
      augmentationTemplates: editingAugmentationId
        ? current.augmentationTemplates.map((template) =>
            template.id === editingAugmentationId ? augmentation : template
          )
        : [...current.augmentationTemplates, augmentation]
    }));
    resetAugmentationEditor();
  };

  const removeAugmentation = (augmentationId: string): void => {
    setValues((current) => ({
      ...current,
      augmentationTemplates: current.augmentationTemplates.filter(
        (template) => template.id !== augmentationId
      )
    }));
    if (editingAugmentationId === augmentationId) {
      resetAugmentationEditor();
    }
  };

  return (
    <Panel
      title="Item / Equipment Maker"
      subtitle="Gear, consumables, and loot. Items can grant actions and passive effects to whoever carries or equips them."
      actions={
        editingItemId ? (
          <div className="inline-actions">
            <button className="button button--secondary" onClick={startNewItem}>
              New Item
            </button>
            <button className="button button--danger" onClick={() => deleteItem(editingItemId)}>
              Delete Item
            </button>
          </div>
        ) : null
      }
    >
      <div className="stack">
        {pendingPlayerItems.length > 0 ? (
          <section className="stack" aria-labelledby="pending-player-items-title">
            <div>
              <h3 id="pending-player-items-title">Player Item Approvals</h3>
              <p className="muted">
                Approval publishes the item to players and adds one copy to the submitting
                character. Denial permanently deletes the proposal.
              </p>
            </div>
            <div className="list">
              {pendingPlayerItems.map((item) => (
                <article className="list-item list-item--block" key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <p className="muted">
                      Submitted by {item.submitted_by_name ?? "Unknown character"} ·{" "}
                      {item.category || "Uncategorized"} · {item.weight} lb
                    </p>
                    {item.description ? <p>{item.description}</p> : null}
                  </div>
                  <div className="inline-actions">
                    <button
                      type="button"
                      className="button"
                      onClick={() =>
                        client.sendProtocolRequest(
                          buildReviewPlayerItemRequest({ itemId: item.id, approved: true }),
                          `Approve item: ${item.name}`
                        )
                      }
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="button button--danger"
                      onClick={() =>
                        client.sendProtocolRequest(
                          buildReviewPlayerItemRequest({ itemId: item.id, approved: false }),
                          `Deny item: ${item.name}`
                        )
                      }
                    >
                      Deny
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
        <CatalogEditorLayout
          catalogLabel="Item Catalog"
          catalog={
            <CatalogTileGrid
              items={items.map((item) => ({ id: item.id, name: item.name }))}
              selectedId={editingItemId}
              emptyMessage="No items created yet."
              onSelect={(itemId) => {
                const item = itemRecords[itemId];
                if (!item) {
                  return;
                }
                setEditingItemId(item.id);
                setValues(toItemEditorValues(item));
                resetAugmentationEditor();
              }}
            />
          }
        >
          <ItemEditorForm
            editingItemId={editingItemId}
            values={values}
            onChange={setValues}
            actions={actions}
            attributeDefinitions={attributeDefinitions}
            proficiencies={proficiencyRecords}
            pending={Boolean(submittedCreateId)}
            attributesEditor={
              <ItemAttributesEditor
                values={values}
                definitions={attributeDefinitions}
                proficiencies={proficiencyRecords}
                metadata={actionFormulaAuthoringMetadata}
                onChange={setValues}
              />
            }
            effectEditor={
              <ItemAugmentationTemplatePanel
                itemName={values.name.trim() || "New equippable item"}
                editingAugmentationId={editingAugmentationId}
                templates={values.augmentationTemplates}
                targetOptions={targetOptions}
                selectorOptions={selectorOptions}
                formulaMetadata={actionFormulaAuthoringMetadata}
                values={augmentationValues}
                onChange={setAugmentationValues}
                onSubmit={submitAugmentation}
                onCancel={resetAugmentationEditor}
                onEdit={(augmentation) => {
                  setEditingAugmentationId(augmentation.id);
                  setAugmentationValues(toAugmentationEditorValues(augmentation));
                }}
                onRemove={removeAugmentation}
              />
            }
            onSubmit={onSubmit}
            onCancel={startNewItem}
            onOpenActionAuthoring={() =>
              dispatch({ type: "set_gm_view", view: "action_authoring" })
            }
          />
        </CatalogEditorLayout>
      </div>
    </Panel>
  );
}
