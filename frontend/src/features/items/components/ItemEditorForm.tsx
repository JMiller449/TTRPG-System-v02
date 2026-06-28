import { Field } from "@/shared/ui/Field";
import {
  ITEM_RANK_OPTIONS,
  type ItemEditorValues
} from "@/features/items/itemEditorValues";
import type { ActionDefinition } from "@/domain/models";

export function ItemEditorForm({
  editingItemId,
  values,
  onChange,
  actions,
  onSubmit,
  onCancel
}: {
  editingItemId: string | null;
  values: ItemEditorValues;
  onChange: (values: ItemEditorValues) => void;
  actions: ActionDefinition[];
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

        <Field label="World Anvil URL">
          <input
            value={values.worldAnvilUrl}
            onChange={(event) => onChange({ ...values, worldAnvilUrl: event.target.value })}
            placeholder="https://..."
          />
        </Field>

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

        <Field label="GM Notes">
          <textarea
            rows={3}
            value={values.gmNotes}
            onChange={(event) => onChange({ ...values, gmNotes: event.target.value })}
            placeholder="Private GM notes"
          />
        </Field>

        <Field label="GM Special Properties">
          <textarea
            rows={3}
            value={values.gmSpecialProperties}
            onChange={(event) => onChange({ ...values, gmSpecialProperties: event.target.value })}
            placeholder="Private mechanical notes or hidden properties"
          />
        </Field>

        <div className="stack">
          <div className="list-item__top">
            <strong>Granted Actions</strong>
            <button
              className="button button--secondary"
              type="button"
              onClick={() =>
                onChange({
                  ...values,
                  actionGrants: [
                    ...values.actionGrants,
                    { actionId: "", availability: "carried", consumeQuantity: "0" }
                  ]
                })
              }
            >
              Add Action Grant
            </button>
          </div>
          <p className="muted">
            Carried actions require positive quantity. Equipped actions also require the item to be active.
          </p>
          {values.actionGrants.map((grant, index) => (
            <div className="inline-group" key={`${grant.actionId}-${index}`}>
              <Field label="Action">
                <select
                  value={grant.actionId}
                  onChange={(event) => {
                    const actionGrants = [...values.actionGrants];
                    actionGrants[index] = { ...grant, actionId: event.target.value };
                    onChange({ ...values, actionGrants });
                  }}
                >
                  <option value="">Select action</option>
                  {actions.map((action) => (
                    <option key={action.id} value={action.id}>
                      {action.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Available while">
                <select
                  value={grant.availability}
                  onChange={(event) => {
                    const actionGrants = [...values.actionGrants];
                    actionGrants[index] = {
                      ...grant,
                      availability: event.target.value as "carried" | "equipped"
                    };
                    onChange({ ...values, actionGrants });
                  }}
                >
                  <option value="carried">Carried</option>
                  <option value="equipped">Equipped</option>
                </select>
              </Field>
              <Field label="Quantity consumed">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={grant.consumeQuantity}
                  onChange={(event) => {
                    const actionGrants = [...values.actionGrants];
                    actionGrants[index] = { ...grant, consumeQuantity: event.target.value };
                    onChange({ ...values, actionGrants });
                  }}
                />
              </Field>
              <button
                className="button button--secondary"
                type="button"
                onClick={() =>
                  onChange({
                    ...values,
                    actionGrants: values.actionGrants.filter((_, grantIndex) => grantIndex !== index)
                  })
                }
              >
                Remove
              </button>
            </div>
          ))}
        </div>

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
