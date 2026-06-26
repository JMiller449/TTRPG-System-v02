import type { Augmentation } from "@/domain/models";
import { Field } from "@/shared/ui/Field";
import {
  applyAugmentationTargetOption,
  augmentationEditorTargetKey,
  augmentationTargetOptionKey,
  formatAugmentationTargetOption,
  hasValidAugmentationEditorValues,
  isKnownAugmentationEditorTarget,
  type AugmentationEditorValues,
  type AugmentationTargetOption
} from "@/features/augmentations/augmentationEditorValues";

const AUGMENTATION_OPERATIONS = ["add", "subtract", "multiply", "divide", "set"] as const;

function formatTarget(augmentation: Augmentation): string {
  const path = augmentation.target.path.length > 0 ? augmentation.target.path.join(".") : "(none)";
  return `${augmentation.target.root}.${path}`;
}

export function ItemAugmentationTemplatePanel({
  itemName,
  editingAugmentationId,
  templates,
  targetOptions,
  values,
  onChange,
  onSubmit,
  onCancel,
  onEdit,
  onRemove
}: {
  itemName: string;
  editingAugmentationId: string | null;
  templates: Augmentation[];
  targetOptions: AugmentationTargetOption[];
  values: AugmentationEditorValues;
  onChange: (values: AugmentationEditorValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onEdit: (augmentation: Augmentation) => void;
  onRemove: (augmentationId: string) => void;
}): JSX.Element {
  const selectedTargetKey = augmentationEditorTargetKey(values);
  const hasCurrentTargetPath = values.targetPath.some((segment) => segment.trim().length > 0);
  const targetIsKnown = isKnownAugmentationEditorTarget(values, targetOptions);
  const canSubmit = hasValidAugmentationEditorValues(values) && targetIsKnown;

  return (
    <section className="template-editor augmentation-template-panel">
      <div className="list-item__top">
        <p className="template-editor__title">Item Augmentations</p>
        <span className="muted">{itemName}</span>
      </div>

      <div className="stack">
        <div className="inline-group">
          <Field label="Name">
            <input
              value={values.name}
              onChange={(event) => onChange({ ...values, name: event.target.value })}
              placeholder="e.g. Arcane guard"
            />
          </Field>
          <Field label="Target">
            <select
              value={targetIsKnown ? selectedTargetKey : ""}
              onChange={(event) => {
                const target = targetOptions.find(
                  (option) => augmentationTargetOptionKey(option) === event.target.value
                );
                if (target) {
                  onChange(applyAugmentationTargetOption(values, target));
                }
              }}
              disabled={targetOptions.length === 0}
            >
              <option value="">
                {targetOptions.length === 0 ? "Target metadata unavailable" : "Select target"}
              </option>
              {!targetIsKnown && hasCurrentTargetPath ? (
                <option value={selectedTargetKey} disabled>
                  Unavailable target ({selectedTargetKey})
                </option>
              ) : null}
              {targetOptions.map((target) => (
                <option key={augmentationTargetOptionKey(target)} value={augmentationTargetOptionKey(target)}>
                  {formatAugmentationTargetOption(target)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Operation">
            <select
              value={values.operation}
              onChange={(event) =>
                onChange({
                  ...values,
                  operation: event.target.value as AugmentationEditorValues["operation"]
                })
              }
            >
              {AUGMENTATION_OPERATIONS.map((operation) => (
                <option key={operation} value={operation}>
                  {operation}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Description">
          <textarea
            rows={2}
            value={values.description}
            onChange={(event) => onChange({ ...values, description: event.target.value })}
            placeholder="GM-facing augmentation notes"
          />
        </Field>

        <Field label="Formula">
          <textarea
            rows={2}
            value={values.formulaText}
            onChange={(event) => onChange({ ...values, formulaText: event.target.value })}
            placeholder="@arcane + 2"
          />
        </Field>

        <div className="inline-group">
          <Field label="Duration">
            <input
              value={values.duration}
              onChange={(event) => onChange({ ...values, duration: event.target.value })}
              placeholder="encounter"
            />
          </Field>
          <Field label="Expires At">
            <input
              value={values.expiresAt}
              onChange={(event) => onChange({ ...values, expiresAt: event.target.value })}
              placeholder="manual"
            />
          </Field>
          <Field label="Removal Condition">
            <input
              value={values.removalCondition}
              onChange={(event) => onChange({ ...values, removalCondition: event.target.value })}
              placeholder="item removed"
            />
          </Field>
        </div>

        <label className="augmentation-template-panel__active">
          <input
            type="checkbox"
            checked={values.active}
            onChange={(event) => onChange({ ...values, active: event.target.checked })}
          />
          <span>Active</span>
        </label>

        <div className="template-editor__actions">
          <button className="button" onClick={onSubmit} disabled={!canSubmit}>
            {editingAugmentationId ? "Save Augmentation" : "Attach Augmentation"}
          </button>
          {editingAugmentationId ? (
            <button className="button button--secondary" onClick={onCancel}>
              Cancel
            </button>
          ) : null}
        </div>

        <div className="list">
          {templates.length === 0 ? <p className="muted">No item augmentations.</p> : null}
          {templates.map((augmentation) => (
            <article className="list-item list-item--block augmentation-template-card" key={augmentation.id}>
              <div className="list-item__top">
                <strong>{augmentation.name}</strong>
                <span className="muted">{augmentation.active ?? true ? "active" : "inactive"}</span>
              </div>
              <div className="muted">Target: {formatTarget(augmentation)}</div>
              <div className="muted">
                Effect: {augmentation.effect.operation} {augmentation.effect.value.text || "(blank)"}
              </div>
              {augmentation.description ? <div className="muted">{augmentation.description}</div> : null}
              <div className="inline-actions">
                <button className="button button--secondary" onClick={() => onEdit(augmentation)}>
                  Edit
                </button>
                <button className="button button--secondary" onClick={() => onRemove(augmentation.id)}>
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
