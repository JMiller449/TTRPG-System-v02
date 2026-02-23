import { useMemo, useState } from "react";
import { useAppStore } from "@/app/state/store";
import type { ItemTemplate } from "@/domain/models";
import { ItemEditorForm } from "@/features/items/components/ItemEditorForm";
import { ItemTemplateList } from "@/features/items/components/ItemTemplateList";
import {
  createEmptyItemValues,
  toItemEditorValues,
  toItemTemplate,
  type ItemEditorValues
} from "@/features/items/itemEditorValues";
import { Panel } from "@/shared/ui/Panel";

export function ItemMakerPage(): JSX.Element {
  const {
    state: { itemTemplates, itemTemplateOrder },
    dispatch
  } = useAppStore();

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [values, setValues] = useState<ItemEditorValues>(createEmptyItemValues);

  const items = useMemo(
    () => itemTemplateOrder.map((id) => itemTemplates[id]).filter((item): item is ItemTemplate => Boolean(item)),
    [itemTemplateOrder, itemTemplates]
  );

  const onSubmit = (): void => {
    if (!values.name.trim()) {
      return;
    }

    dispatch({
      type: "upsert_item_template",
      item: toItemTemplate(values, editingItemId ?? undefined)
    });

    setEditingItemId(null);
    setValues(createEmptyItemValues());
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
          onDelete={(itemId) => dispatch({ type: "remove_item_template", itemId })}
        />
      </div>
    </Panel>
  );
}
