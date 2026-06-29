import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
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
import { ItemDefinitionList } from "@/features/items/components/ItemDefinitionList";
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
import { Panel } from "@/shared/ui/Panel";
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
        formulaOrder
      },
      uiState: { augmentationTargetMetadata }
    },
    dispatch
  } = useAppStore();

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [values, setValues] = useState<ItemEditorValues>(createEmptyItemValues);
  const [editingAugmentationId, setEditingAugmentationId] = useState<string | null>(null);
  const [augmentationValues, setAugmentationValues] = useState<AugmentationEditorValues>(
    createEmptyAugmentationEditorValues
  );

  const items = useMemo(
    () => selectOrderedItemDefinitions(itemRecords, itemOrder),
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

  const resetAugmentationEditor = (): void => {
    setEditingAugmentationId(null);
    setAugmentationValues(createEmptyAugmentationEditorValues());
  };

  const startNewItem = (): void => {
    setEditingItemId(null);
    setValues(createEmptyItemValues());
    resetAugmentationEditor();
  };

  const onSubmit = (): void => {
    if (!values.name.trim()) {
      return;
    }

    const submission = editingItemId
      ? buildUpdateItemSubmission(itemRecords[editingItemId], values)
      : buildCreateItemSubmission(values, makeId("item"));
    if (!submission) {
      return;
    }

    client.sendProtocolRequest(submission.request, submission.label);
    startNewItem();
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
      actions={
        editingItemId ? (
          <button className="button button--secondary" onClick={startNewItem}>
            New Item
          </button>
        ) : null
      }
    >
      <div className="stack">
        <ItemEditorForm
          editingItemId={editingItemId}
          values={values}
          onChange={setValues}
          actions={actions}
          effectEditor={
            <ItemAugmentationTemplatePanel
              itemName={values.name.trim() || "New equippable item"}
              editingAugmentationId={editingAugmentationId}
              templates={values.augmentationTemplates}
              targetOptions={targetOptions}
              selectorOptions={selectorOptions}
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
          onOpenActionAuthoring={() => dispatch({ type: "set_gm_view", view: "action_authoring" })}
        />

        <ItemDefinitionList
          items={items}
          actions={actionRecords}
          onEdit={(item) => {
            setEditingItemId(item.id);
            setValues(toItemEditorValues(item));
            resetAugmentationEditor();
          }}
          onDelete={deleteItem}
        />
      </div>
    </Panel>
  );
}
