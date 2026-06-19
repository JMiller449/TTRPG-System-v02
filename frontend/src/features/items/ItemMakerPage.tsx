import { useMemo, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import type { GameClient } from "@/hooks/useGameClient";
import { ItemAugmentationTemplatePanel } from "@/features/augmentations/components/ItemAugmentationTemplatePanel";
import {
  createEmptyAugmentationEditorValues,
  toAugmentationEditorValues,
  type AugmentationEditorValues
} from "@/features/augmentations/augmentationEditorValues";
import {
  buildRemoveItemAugmentationTemplateSubmission,
  buildUpsertItemAugmentationTemplateSubmission,
  selectItemAugmentationTemplates
} from "@/features/augmentations/augmentationRequests";
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
      serverState: { items: itemRecords, itemOrder }
    }
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
  const selectedItem = editingItemId ? itemRecords[editingItemId] : undefined;

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
    const submission = buildUpsertItemAugmentationTemplateSubmission({
      item: selectedItem,
      values: augmentationValues,
      augmentationId: editingAugmentationId ?? makeId("augmentation")
    });
    if (!submission) {
      return;
    }

    client.sendProtocolRequest(submission.request, submission.label);
    resetAugmentationEditor();
  };

  const removeAugmentation = (augmentationId: string): void => {
    const submission = buildRemoveItemAugmentationTemplateSubmission({
      item: selectedItem,
      augmentationId
    });
    if (!submission) {
      return;
    }

    client.sendProtocolRequest(submission.request, submission.label);
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
        <p className="muted">
          Split item effects into two fields: immediate effects that impact wearer stats vs non-immediate effects used
          for other systems (for example, enchanting).
        </p>
        <p className="muted">
          TODO: validate seeded reference-item effect splits against final rules authority where classification is
          ambiguous.
        </p>

        <ItemEditorForm
          editingItemId={editingItemId}
          values={values}
          onChange={setValues}
          onSubmit={onSubmit}
          onCancel={startNewItem}
        />

        {selectedItem ? (
          <ItemAugmentationTemplatePanel
            itemName={selectedItem.name}
            editingAugmentationId={editingAugmentationId}
            templates={selectItemAugmentationTemplates(selectedItem)}
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
        ) : null}

        <ItemDefinitionList
          items={items}
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
