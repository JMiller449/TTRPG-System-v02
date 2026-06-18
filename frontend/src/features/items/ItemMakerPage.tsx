import { useMemo, useState } from "react";
import { useAppStore } from "@/app/state/store";
import type { GameClient } from "@/hooks/useGameClient";
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

  const items = useMemo(
    () => selectOrderedItemDefinitions(itemRecords, itemOrder),
    [itemOrder, itemRecords]
  );

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
    setEditingItemId(null);
    setValues(createEmptyItemValues());
  };

  const deleteItem = (itemId: string): void => {
    const submission = buildDeleteItemSubmission(itemId, itemRecords[itemId]);
    client.sendProtocolRequest(submission.request, submission.label);
    if (editingItemId === itemId) {
      setEditingItemId(null);
      setValues(createEmptyItemValues());
    }
  };

  return (
    <Panel title="Item / Equipment Maker">
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
          onCancel={() => {
            setEditingItemId(null);
            setValues(createEmptyItemValues());
          }}
        />

        <ItemDefinitionList
          items={items}
          onEdit={(item) => {
            setEditingItemId(item.id);
            setValues(toItemEditorValues(item));
          }}
          onDelete={deleteItem}
        />
      </div>
    </Panel>
  );
}
