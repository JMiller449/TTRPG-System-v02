import type { KeyboardEvent } from "react";
import { Field } from "@/shared/ui/Field";
import {
  DISPLAY_NAMES,
  formatModifier,
  PLAYER_HEALTH_DAMAGE_TYPES,
  type HealthDamageType,
  type ResourceKey,
  RESOURCE_KEYS,
  type SheetStatKey
} from "@/features/sheets/sheetDisplay";

export function SheetResourceHeader({
  stats,
  resources,
  editingResource,
  resourceDraftModifier,
  healthDamageType,
  resourceEditorError,
  onBeginResourceEdit,
  onResourceDraftModifierChange,
  onHealthDamageTypeChange,
  onApplyResourceModifier,
  onCancelResourceEdit,
  onResourceEditorKeyDown
}: {
  stats: Partial<Record<SheetStatKey, number>>;
  resources: Record<ResourceKey, number>;
  editingResource: ResourceKey | null;
  resourceDraftModifier: string;
  healthDamageType: HealthDamageType;
  resourceEditorError: string | null;
  onBeginResourceEdit: (key: ResourceKey) => void;
  onResourceDraftModifierChange: (value: string) => void;
  onHealthDamageTypeChange: (value: HealthDamageType) => void;
  onApplyResourceModifier: (key: ResourceKey) => void;
  onCancelResourceEdit: () => void;
  onResourceEditorKeyDown: (event: KeyboardEvent<HTMLInputElement>, key: ResourceKey) => void;
}): JSX.Element {
  return (
    <div className="resource-grid resource-grid--header">
      {RESOURCE_KEYS.map((key) => {
        const baseValue = stats[key] ?? 0;
        const currentValue = resources[key];
        const delta = currentValue - baseValue;
        const editorId = `resource-editor-${key}`;
        const errorId = `${editorId}-error`;
        const hintId = `${editorId}-hint`;
        return (
          <article key={key} className="resource-card">
            <div className="resource-card__top">
              <span className="resource-card__label">{DISPLAY_NAMES[key]}</span>
              <button
                type="button"
                className="resource-card__value-btn"
                onClick={() => onBeginResourceEdit(key)}
                aria-label={`Edit ${DISPLAY_NAMES[key]}. Current ${currentValue} of ${baseValue}.`}
                aria-expanded={editingResource === key}
                aria-controls={editorId}
              >
                <strong
                  className={`resource-card__value ${delta > 0 ? "stat-value--up" : delta < 0 ? "stat-value--down" : ""}`}
                >
                  {currentValue}/{baseValue}
                </strong>
              </button>
            </div>
            {delta !== 0 ? (
              <div className="resource-card__delta-row">
                <span
                  className={`stat-modifier ${delta > 0 ? "stat-modifier--up" : "stat-modifier--down"}`}
                >
                  {formatModifier(delta)}
                </span>
              </div>
            ) : null}

            {editingResource === key ? (
              <div
                className="stat-editor"
                id={editorId}
                role="group"
                aria-label={`Edit ${DISPLAY_NAMES[key]}`}
              >
                <Field label={`${DISPLAY_NAMES[key]} Modifier`}>
                  <input
                    value={resourceDraftModifier}
                    onChange={(event) => onResourceDraftModifierChange(event.target.value)}
                    onKeyDown={(event) => onResourceEditorKeyDown(event, key)}
                    inputMode="numeric"
                    placeholder="+10 or -10"
                    aria-label={`${DISPLAY_NAMES[key]} resource modifier`}
                    aria-describedby={resourceEditorError ? errorId : hintId}
                    aria-invalid={Boolean(resourceEditorError)}
                    autoFocus
                  />
                </Field>
                {key === "health" ? (
                  <Field label="Damage Type">
                    <select
                      value={healthDamageType}
                      onChange={(event) =>
                        onHealthDamageTypeChange(event.target.value as HealthDamageType)
                      }
                      aria-label="Health adjustment damage type"
                    >
                      <option value="">Select damage type</option>
                      {PLAYER_HEALTH_DAMAGE_TYPES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : null}
                <button
                  type="button"
                  className="button"
                  onClick={() => onApplyResourceModifier(key)}
                >
                  Apply
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={onCancelResourceEdit}
                >
                  Cancel
                </button>
                {resourceEditorError ? (
                  <p className="error-text stat-editor__error" id={errorId} role="alert">
                    {resourceEditorError}
                  </p>
                ) : key === "health" ? (
                  <p className="muted stat-editor__hint" id={hintId}>
                    Negative modifiers apply typed damage after backend resistance; positive
                    modifiers restore health directly.
                  </p>
                ) : (
                  <p className="muted stat-editor__hint" id={hintId}>
                    Updates active value only.
                  </p>
                )}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
