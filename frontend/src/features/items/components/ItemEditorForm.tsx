import type { ReactNode } from "react";
import { Field } from "@/shared/ui/Field";
import {
  getItemEditorValidationError,
  ITEM_RANK_OPTIONS,
  type ItemEditorValues
} from "@/features/items/itemEditorValues";
import type {
  ActionDefinition,
  AttributeDefinition,
  ItemInteractionType,
  ProficiencyDefinition,
  TagDefinition
} from "@/domain/models";
import { ItemActionGrantEditor } from "@/features/items/components/ItemActionGrantEditor";
import { ItemPlayerAvailabilityEditor } from "@/features/items/components/ItemPlayerAvailabilityEditor";
import { CatalogEntityMultiSelect } from "@/features/catalogs/CatalogEntityMultiSelect";
import { FormValidationSummary } from "@/shared/ui/FormValidationSummary";

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
  attributeDefinitions,
  proficiencies,
  tagDefinitions,
  attributesEditor,
  effectEditor,
  effectEditorFocused = false,
  pending = false,
  validationAttempted = false,
  editorKind = "item",
  showPlayerAvailability = true,
  onSubmit,
  onCancel,
  onOpenActionAuthoring
}: {
  editingItemId: string | null;
  values: ItemEditorValues;
  onChange: (values: ItemEditorValues) => void;
  actions: ActionDefinition[];
  attributeDefinitions: Record<string, AttributeDefinition>;
  proficiencies: Record<string, ProficiencyDefinition>;
  tagDefinitions: Record<string, TagDefinition>;
  attributesEditor: ReactNode;
  effectEditor: ReactNode;
  effectEditorFocused?: boolean;
  pending?: boolean;
  validationAttempted?: boolean;
  editorKind?: "item" | "template";
  showPlayerAvailability?: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  onOpenActionAuthoring?: () => void;
}): JSX.Element {
  const validationError = getItemEditorValidationError(values, {
    definitions: attributeDefinitions,
    proficiencies
  });
  const nameMissing = !values.name.trim();
  const weight = Number(values.weight);
  const weightInvalid = !values.weight.trim() || !Number.isFinite(weight) || weight < 0;
  const storageWeight = Number(values.storageCapacityWeight);
  const storageWeightInvalid =
    values.canContainItems &&
    Boolean(values.storageCapacityWeight.trim()) &&
    (!Number.isFinite(storageWeight) || storageWeight < 0);

  const setInteractionType = (interactionType: ItemInteractionType): void => {
    const nextValues: ItemEditorValues = {
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
    onChange(nextValues);
  };

  return (
    <div
      className={`item-editor stack${effectEditorFocused ? " item-editor--effect-focused" : ""}`}
    >
      <div className="item-editor__heading">
        <h3>
          {editingItemId
            ? editorKind === "template"
              ? "Edit Item Template"
              : "Edit Item"
            : editorKind === "template"
              ? "Create Item Template"
              : "Create Item"}
        </h3>
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
        <Field label="Name" required invalid={validationAttempted && nameMissing}>
          <input
            value={values.name}
            required
            aria-invalid={validationAttempted && nameMissing}
            onChange={(event) => onChange({ ...values, name: event.target.value })}
            placeholder="e.g. Sword of mana"
          />
        </Field>

        <div className="inline-group">
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
          <Field label="Weight" required invalid={validationAttempted && weightInvalid}>
            <input
              type="number"
              min="0"
              step="any"
              value={values.weight}
              required
              aria-invalid={validationAttempted && weightInvalid}
              onChange={(event) => onChange({ ...values, weight: event.target.value })}
              placeholder="e.g. 3"
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

        {showPlayerAvailability ? (
          <ItemPlayerAvailabilityEditor
            value={values.playerCatalogAccess}
            onChange={(playerCatalogAccess) => onChange({ ...values, playerCatalogAccess })}
          />
        ) : null}

        <details className="authoring-disclosure">
          <summary>
            <span>
              <strong>Tags</strong>
              <small>Managed classification and action context</small>
            </span>
          </summary>
          <div className="authoring-disclosure__body">
            <CatalogEntityMultiSelect
              catalog="tags"
              label="Item tags"
              options={Object.values(tagDefinitions).map((tag) => ({
                id: tag.id,
                label: tag.name,
                secondary: tag.description || tag.id
              }))}
              selectedIds={values.tags}
              onChange={(tags) => onChange({ ...values, tags })}
              emptyMessage="No managed tags exist yet."
              noResultsMessage="No managed tags match this search."
              selectionAriaLabel={(tagName) => `Select tag ${tagName}`}
              folderSelectionAriaLabel={(folderName) => `Select all tags in ${folderName}`}
            />
          </div>
        </details>

        <details className="authoring-disclosure">
          <summary>
            <span>
              <strong>Reference and GM notes</strong>
              <small>Optional</small>
            </span>
          </summary>
          <div className="authoring-disclosure__body stack">
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
                  onChange={(event) =>
                    onChange({ ...values, gmSpecialProperties: event.target.value })
                  }
                  placeholder="Private properties"
                />
              </Field>
            ) : null}
          </div>
        </details>
      </section>

      <details className="authoring-disclosure">
        <summary>
          <span>
            <strong>Storage</strong>
            <small>Optional inventory containment</small>
          </span>
        </summary>
        <div className="authoring-disclosure__body stack">
          <label className="augmentation-template-panel__active">
            <input
              type="checkbox"
              checked={values.canContainItems}
              onChange={(event) =>
                onChange({
                  ...values,
                  canContainItems: event.target.checked,
                  storageCapacityWeight: event.target.checked ? values.storageCapacityWeight : "",
                  contentsWeightBehavior: event.target.checked
                    ? values.contentsWeightBehavior
                    : "normal"
                })
              }
            />
            <span>This item can contain other inventory entries</span>
          </label>
          {values.canContainItems ? (
            <>
              <Field
                label="Storage weight limit (lb)"
                invalid={validationAttempted && storageWeightInvalid}
              >
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={values.storageCapacityWeight}
                  aria-invalid={validationAttempted && storageWeightInvalid}
                  onChange={(event) =>
                    onChange({
                      ...values,
                      storageCapacityWeight: event.target.value
                    })
                  }
                  placeholder="Unlimited"
                />
              </Field>
              <label className="augmentation-template-panel__active">
                <input
                  type="checkbox"
                  checked={values.contentsWeightBehavior === "ignored"}
                  onChange={(event) =>
                    onChange({
                      ...values,
                      contentsWeightBehavior: event.target.checked ? "ignored" : "normal"
                    })
                  }
                />
                <span>Stored contents do not add to carried weight</span>
              </label>
            </>
          ) : null}
          <p className="muted">
            The container's own weight always counts. Leave the limit blank for unlimited storage.
            Volume and item slots are not tracked.
          </p>
        </div>
      </details>

      <details className="authoring-disclosure">
        <summary>
          <span>
            <strong>Attributes</strong>
            <small>Optional values consumed by actions and effects</small>
          </span>
        </summary>
        <div className="authoring-disclosure__body">{attributesEditor}</div>
      </details>

      {values.interactionType === "equippable" ? (
        <details
          className="authoring-disclosure item-editor__effects-disclosure"
          open={effectEditorFocused || undefined}
        >
          <summary>
            <span>
              <strong>Equipment effects</strong>
              <small>Optional changes while worn</small>
            </span>
          </summary>
          <div className="authoring-disclosure__body">{effectEditor}</div>
        </details>
      ) : null}

      {values.interactionType !== "inventory_only" ? (
        <details className="authoring-disclosure">
          <summary>
            <span>
              <strong>Granted actions</strong>
              <small>Optional actions available from this item</small>
            </span>
          </summary>
          <div className="authoring-disclosure__body">
            <ItemActionGrantEditor
              values={values}
              actions={actions}
              onChange={onChange}
              onOpenActionAuthoring={onOpenActionAuthoring}
            />
          </div>
        </details>
      ) : null}

      <FormValidationSummary
        visible={validationAttempted && Boolean(validationError)}
        message={
          nameMissing
            ? "Complete all required fields."
            : (validationError ?? "Review the indicated fields.")
        }
      />
      <div className="template-editor__actions item-editor__actions">
        <button className="button" onClick={onSubmit} disabled={pending}>
          {pending
            ? "Creating…"
            : editingItemId
              ? editorKind === "template"
                ? "Save Template"
                : "Save Item"
              : editorKind === "template"
                ? "Create Template"
                : "Create Item"}
        </button>
        <button className="button button--secondary" onClick={onCancel} disabled={pending}>
          {editingItemId ? "Cancel" : "Discard Draft"}
        </button>
      </div>
    </div>
  );
}
