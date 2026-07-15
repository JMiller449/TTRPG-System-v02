import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from "react";
import { Field } from "@/shared/ui/Field";
import {
  DISPLAY_NAMES,
  formatModifier,
  PLAYER_HEALTH_DAMAGE_TYPES,
  type HealthDamageType,
  type ResourceKey,
  RESOURCE_KEYS
} from "@/features/sheets/sheetDisplay";

export function SheetResourceHeader({
  maximums,
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
  maximums: Record<ResourceKey, number>;
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
  const resourceGridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editingResource) {
      return;
    }

    const handlePointerDown = (event: PointerEvent): void => {
      const activeCard = resourceGridRef.current?.querySelector(
        `.resource-card--${editingResource}`
      );
      if (event.target instanceof Node && activeCard?.contains(event.target)) {
        return;
      }
      onCancelResourceEdit();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [editingResource, onCancelResourceEdit]);

  return (
    <div className="resource-grid resource-grid--header" ref={resourceGridRef}>
      {RESOURCE_KEYS.map((key) => {
        const baseValue = maximums[key];
        const currentValue = resources[key];
        const delta = currentValue - baseValue;
        const editorId = `resource-editor-${key}`;
        const errorId = `${editorId}-error`;
        const hintId = `${editorId}-hint`;
        const fillPercent =
          baseValue > 0 ? Math.max(0, Math.min(100, (currentValue / baseValue) * 100)) : 0;
        return (
          <article key={key} className={`resource-card resource-card--${key}`}>
            <button
              type="button"
              className="resource-card__trigger"
              onClick={() => onBeginResourceEdit(key)}
              aria-label={`Edit ${DISPLAY_NAMES[key]}. Current ${currentValue} of ${baseValue}.`}
              aria-expanded={editingResource === key}
              aria-controls={editorId}
            >
              <span className="resource-card__top">
                <span className="resource-card__label">{DISPLAY_NAMES[key]}</span>
                <strong
                  className={`resource-card__value ${delta > 0 ? "stat-value--up" : delta < 0 ? "stat-value--down" : ""}`}
                >
                  {currentValue}/{baseValue}
                </strong>
              </span>
              <span className="resource-card__meter" aria-hidden="true">
                <span
                  className="resource-card__meter-fill"
                  style={{ "--resource-fill": `${fillPercent}%` } as CSSProperties}
                />
              </span>
              {delta !== 0 ? (
                <span className="resource-card__delta-row">
                  <span
                    className={`stat-modifier ${delta > 0 ? "stat-modifier--up" : "stat-modifier--down"}`}
                  >
                    {formatModifier(delta)}
                  </span>
                </span>
              ) : null}
            </button>

            {editingResource === key ? (
              <div
                className={`stat-editor stat-editor--resource-popover stat-editor--resource-popover-${key}`}
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
