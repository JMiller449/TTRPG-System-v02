import type { ReactNode } from "react";
import { Field } from "@/shared/ui/Field";
import {
  getItemEditorValidationError,
  ITEM_RANK_OPTIONS,
  setItemFactProfile,
  type ItemEditorValues
} from "@/features/items/itemEditorValues";
import type {
  ActionDefinition,
  FactDefinition,
  ItemInteractionType,
  ProficiencyDefinition
} from "@/domain/models";
import { ItemActionGrantEditor } from "@/features/items/components/ItemActionGrantEditor";

const ITEM_INTERACTION_TYPES: ReadonlyArray<{
  value: ItemInteractionType;
  label: string;
}> = [
  { value: "equippable", label: "Equippable" },
  { value: "consumable", label: "Consumable" },
  { value: "inventory_only", label: "Inventory Only" }
];

export function ItemEditorForm({
  editingItemId,
  values,
  onChange,
  actions,
  factDefinitions,
  proficiencies,
  factsEditor,
  effectEditor,
  onSubmit,
  onCancel,
  onOpenActionAuthoring
}: {
  editingItemId: string | null;
  values: ItemEditorValues;
  onChange: (values: ItemEditorValues) => void;
  actions: ActionDefinition[];
  factDefinitions: Record<string, FactDefinition>;
  proficiencies: Record<string, ProficiencyDefinition>;
  factsEditor: ReactNode;
  effectEditor: ReactNode;
  onSubmit: () => void;
  onCancel: () => void;
  onOpenActionAuthoring: () => void;
}): JSX.Element {
  const validationError = getItemEditorValidationError(values, {
    definitions: factDefinitions,
    proficiencies
  });

  const setInteractionType = (interactionType: ItemInteractionType): void => {
    let nextValues: ItemEditorValues = {
      ...values,
      interactionType,
      actionGrants: values.actionGrants.map((grant) => ({
        ...grant,
        availability: interactionType === "consumable" ? "carried" : "equipped",
        consumeQuantity:
          interactionType === "consumable" && Number(grant.consumeQuantity) < 1
            ? "1"
            : grant.consumeQuantity
      }))
    };
    if (interactionType !== "equippable" && nextValues.factProfile) {
      nextValues = setItemFactProfile(nextValues, null, factDefinitions);
    }
    onChange(nextValues);
  };

  return (
    <div className="item-editor stack">
      <div className="item-editor__heading">
        <h3>{editingItemId ? "Edit Item" : "Create Item"}</h3>
        <div className="item-type-control" aria-label="Item interaction type">
          {ITEM_INTERACTION_TYPES.map((option) => (
            <button
              className={`item-type-control__option ${
                values.interactionType === option.value ? "item-type-control__option--active" : ""
              }`}
              type="button"
              aria-pressed={values.interactionType === option.value}
              key={option.value}
              onClick={() => setInteractionType(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <section className="item-details-section stack">
        <h3>Details</h3>
        <Field label="Name">
          <input
            value={values.name}
            onChange={(event) => onChange({ ...values, name: event.target.value })}
            placeholder="e.g. Sword of mana"
          />
        </Field>

        <div className="inline-group">
          <Field label="Category">
            <input
              value={values.type}
              onChange={(event) => onChange({ ...values, type: event.target.value })}
              placeholder="e.g. Sword"
            />
          </Field>
          <Field label="Rank">
            <select
              value={values.rank}
              onChange={(event) => onChange({ ...values, rank: event.target.value })}
            >
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

        <Field label="Reference Description">
          <textarea
            rows={4}
            value={values.description}
            onChange={(event) => onChange({ ...values, description: event.target.value })}
            placeholder="Appearance, history, reach, or other table reference"
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

        {values.interactionType !== "inventory_only" ? (
          <Field label="GM Special Properties">
            <textarea
              rows={3}
              value={values.gmSpecialProperties}
              onChange={(event) => onChange({ ...values, gmSpecialProperties: event.target.value })}
              placeholder="Private properties"
            />
          </Field>
        ) : null}
      </section>

      {factsEditor}

      {values.interactionType === "equippable" ? effectEditor : null}

      {values.interactionType !== "inventory_only" ? (
        <ItemActionGrantEditor
          values={values}
          actions={actions}
          onChange={onChange}
          onOpenActionAuthoring={onOpenActionAuthoring}
        />
      ) : null}

      {validationError ? <p className="error-text">{validationError}</p> : null}
      <div className="template-editor__actions item-editor__actions">
        <button className="button" onClick={onSubmit} disabled={Boolean(validationError)}>
          {editingItemId ? "Save Item" : "Create Item"}
        </button>
        {editingItemId ? (
          <button className="button button--secondary" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}
