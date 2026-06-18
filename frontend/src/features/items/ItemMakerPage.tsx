import { useMemo, useState } from "react";
import { useAppStore } from "@/app/state/store";
import type { ItemDefinition } from "@/domain/models";
import type { GameClient } from "@/hooks/useGameClient";
import { ItemEditorForm } from "@/features/items/components/ItemEditorForm";
import { ItemTemplateList } from "@/features/items/components/ItemTemplateList";
import {
  createEmptyItemValues,
  toItemDefinitionPayload,
  toItemEditorValues,
  toUpdatedItemDefinitionPayload,
  type ItemEditorValues
} from "@/features/items/itemEditorValues";
import {
  buildCreateItemRequest,
  buildDeleteItemRequest,
  buildUpdateItemRequest
} from "@/infrastructure/ws/requestBuilders";
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
    () => itemOrder.map((id) => itemRecords[id]).filter((item): item is ItemDefinition => Boolean(item)),
    [itemOrder, itemRecords]
  );

  const onSubmit = (): void => {
    if (!values.name.trim()) {
      return;
    }

    if (editingItemId) {
      const item = itemRecords[editingItemId];
      if (!item) {
        return;
      }

      const payload = toUpdatedItemDefinitionPayload(item, values);
      client.sendProtocolRequest(
        buildUpdateItemRequest({
          itemId: editingItemId,
          item: payload
        }),
        `Update item: ${payload.name}`
      );
    } else {
      const payload = toItemDefinitionPayload(values, makeId("item"));
      client.sendProtocolRequest(
        buildCreateItemRequest({
          item: payload
        }),
        `Create item: ${payload.name}`
      );
    }

    setEditingItemId(null);
    setValues(createEmptyItemValues());
  };

  const deleteItem = (itemId: string): void => {
    const itemName = itemRecords[itemId]?.name ?? "item";
    client.sendProtocolRequest(
      buildDeleteItemRequest({
        itemId
      }),
      `Delete item: ${itemName}`
    );
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

        <ItemTemplateList
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
