import { Field } from "@/shared/ui/Field";
import {
  ITEM_RANK_OPTIONS,
  type ItemEditorValues
} from "@/features/items/itemEditorValues";

export function ItemEditorForm({
  editingItemId,
  values,
  onChange,
  onSubmit,
  onCancel
}: {
  editingItemId: string | null;
  values: ItemEditorValues;
  onChange: (values: ItemEditorValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
}): JSX.Element {
  return (
    <div className="template-editor item-editor">
      <p className="template-editor__title">{editingItemId ? "Edit Item" : "Create Item"}</p>
      <div className="stack">
        <Field label="Name">
          <input
            value={values.name}
            onChange={(event) => onChange({ ...values, name: event.target.value })}
            placeholder="e.g. Sword of mana"
          />
        </Field>

        <div className="inline-group">
          <Field label="Type">
            <input
              value={values.type}
              onChange={(event) => onChange({ ...values, type: event.target.value })}
              placeholder="e.g. Sword"
            />
          </Field>
          <Field label="Rank">
            <select value={values.rank} onChange={(event) => onChange({ ...values, rank: event.target.value })}>
              {ITEM_RANK_OPTIONS.map((rank) => (
                <option key={rank} value={rank}>
                  {rank}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Weight">
            <input
              value={values.weight}
              onChange={(event) => onChange({ ...values, weight: event.target.value })}
              placeholder="e.g. 3LBS"
            />
          </Field>
          <Field label="Value">
            <input
              value={values.value}
              onChange={(event) => onChange({ ...values, value: event.target.value })}
              placeholder="e.g. 500CP"
            />
          </Field>
        </div>

        <Field label="Immediate Effects (applies to wearer stats)">
          <textarea
            rows={3}
            value={values.immediateEffects}
            onChange={(event) => onChange({ ...values, immediateEffects: event.target.value })}
            placeholder="e.g. +25% mana regen"
          />
        </Field>

        <Field label="Non-Immediate Effects (not auto-applied to sheet values)">
          <textarea
            rows={3}
            value={values.nonImmediateEffects}
            onChange={(event) => onChange({ ...values, nonImmediateEffects: event.target.value })}
            placeholder="e.g. +50 to all effects added to this weapon"
          />
        </Field>

        <div className="template-editor__actions">
          <button className="button" onClick={onSubmit}>
            {editingItemId ? "Save Item" : "Create Item"}
          </button>
          {editingItemId ? (
            <button className="button button--secondary" onClick={onCancel}>
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
