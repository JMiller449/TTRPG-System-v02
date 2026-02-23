import { useMemo, useState } from "react";
import { useAppStore } from "@/app/state/store";
import type { ItemTemplate } from "@/domain/models";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Field } from "@/shared/ui/Field";
import { Panel } from "@/shared/ui/Panel";
import { makeId } from "@/shared/utils/id";

type ItemEditorValues = {
  name: string;
  type: string;
  rank: string;
  weight: string;
  value: string;
  immediateEffects: string;
  nonImmediateEffects: string;
};

function createEmptyValues(): ItemEditorValues {
  return {
    name: "",
    type: "",
    rank: "",
    weight: "",
    value: "",
    immediateEffects: "",
    nonImmediateEffects: ""
  };
}

function toEditorValues(item: ItemTemplate): ItemEditorValues {
  return {
    name: item.name,
    type: item.type,
    rank: item.rank,
    weight: item.weight,
    value: item.value,
    immediateEffects: item.immediateEffects,
    nonImmediateEffects: item.nonImmediateEffects
  };
}

function toItemTemplate(values: ItemEditorValues, existingId?: string): ItemTemplate {
  return {
    id: existingId ?? makeId("item"),
    name: values.name.trim(),
    type: values.type.trim(),
    rank: values.rank.trim(),
    weight: values.weight.trim(),
    value: values.value.trim(),
    immediateEffects: values.immediateEffects.trim(),
    nonImmediateEffects: values.nonImmediateEffects.trim(),
    updatedAt: new Date().toISOString()
  };
}

export function ItemMakerPage(): JSX.Element {
  const {
    state: { itemTemplates, itemTemplateOrder },
    dispatch
  } = useAppStore();

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [values, setValues] = useState<ItemEditorValues>(createEmptyValues);

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
    setValues(createEmptyValues());
  };

  return (
    <Panel title="Item / Equipment Maker">
      <div className="stack">
        <p className="muted">
          Split item effects into two fields: immediate effects that impact wearer stats vs non-immediate effects
          used for other systems (for example, enchanting).
        </p>
        <p className="muted">
          TODO: validate seeded reference-item effect splits against final rules authority where classification is
          ambiguous.
        </p>

        <div className="template-editor">
          <p className="template-editor__title">{editingItemId ? "Edit Item" : "Create Item"}</p>
          <div className="stack">
            <Field label="Name">
              <input
                value={values.name}
                onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="e.g. Sword of mana"
              />
            </Field>
            <div className="inline-group">
              <Field label="Type">
                <input
                  value={values.type}
                  onChange={(event) => setValues((prev) => ({ ...prev, type: event.target.value }))}
                  placeholder="e.g. Sword"
                />
              </Field>
              <Field label="Rank">
                <input
                  value={values.rank}
                  onChange={(event) => setValues((prev) => ({ ...prev, rank: event.target.value }))}
                  placeholder="e.g. S"
                />
              </Field>
              <Field label="Weight">
                <input
                  value={values.weight}
                  onChange={(event) => setValues((prev) => ({ ...prev, weight: event.target.value }))}
                  placeholder="e.g. 3LBS"
                />
              </Field>
              <Field label="Value">
                <input
                  value={values.value}
                  onChange={(event) => setValues((prev) => ({ ...prev, value: event.target.value }))}
                  placeholder="e.g. 500CP"
                />
              </Field>
            </div>
            <Field label="Immediate Effects (applies to wearer stats)">
              <textarea
                rows={3}
                value={values.immediateEffects}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, immediateEffects: event.target.value }))
                }
                placeholder="e.g. +25% mana regen"
              />
            </Field>
            <Field label="Non-Immediate Effects (not auto-applied to sheet values)">
              <textarea
                rows={3}
                value={values.nonImmediateEffects}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, nonImmediateEffects: event.target.value }))
                }
                placeholder="e.g. +50 to all effects added to this weapon"
              />
            </Field>
            <div className="template-editor__actions">
              <button className="button" onClick={onSubmit}>
                {editingItemId ? "Save Item" : "Create Item"}
              </button>
              {editingItemId ? (
                <button
                  className="button button--secondary"
                  onClick={() => {
                    setEditingItemId(null);
                    setValues(createEmptyValues());
                  }}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="list">
          {items.length === 0 ? <EmptyState message="No items created yet." /> : null}
          {items.map((item) => (
            <article key={item.id} className="list-item list-item--block">
              <div className="list-item__top">
                <strong>{item.name}</strong>
                <span className="muted">{new Date(item.updatedAt).toLocaleDateString()}</span>
              </div>
              <div className="muted">
                {item.type} · Rank {item.rank} · Weight {item.weight} · Value {item.value}
              </div>
              <div className="muted">Immediate Effects: {item.immediateEffects || "(none)"}</div>
              <div className="muted">Non-Immediate Effects: {item.nonImmediateEffects || "(none)"}</div>
              <div className="inline-actions">
                <button
                  className="button button--secondary"
                  onClick={() => {
                    setEditingItemId(item.id);
                    setValues(toEditorValues(item));
                  }}
                >
                  Edit
                </button>
                <button
                  className="button button--secondary"
                  onClick={() => dispatch({ type: "remove_item_template", itemId: item.id })}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </Panel>
  );
}
