import type { KeyboardEvent } from "react";
import { Field } from "@/shared/ui/Field";
import {
  CORE_SUBSTAT_GROUPS,
  DISPLAY_NAMES,
  formatModifier,
  isResourceKey,
  type SheetStatKey
} from "@/features/sheets/sheetDisplay";

export function SheetStatsSection({
  canEditStats,
  stats,
  editingKey,
  draftModifier,
  editorError,
  getModifier,
  getCurrentValue,
  onBeginEditing,
  onApplyModifier,
  onResetModifier,
  onDraftModifierChange,
  onCancelEditing,
  onEditorKeyDown
}: {
  canEditStats: boolean;
  stats: Partial<Record<SheetStatKey, number>>;
  editingKey: SheetStatKey | null;
  draftModifier: string;
  editorError: string | null;
  getModifier: (key: SheetStatKey) => number;
  getCurrentValue: (key: SheetStatKey, base: number) => number;
  onBeginEditing: (key: SheetStatKey) => void;
  onApplyModifier: (key: SheetStatKey) => void;
  onResetModifier: (key: SheetStatKey) => void;
  onDraftModifierChange: (value: string) => void;
  onCancelEditing: () => void;
  onEditorKeyDown: (event: KeyboardEvent<HTMLInputElement>, key: SheetStatKey) => void;
}): JSX.Element {
  return (
    <section className="character-sheet__section">
      <h4>Core Stats and Related Substats</h4>
      <p className="muted character-sheet__hint">
        {canEditStats
          ? "GM can click values to apply modifiers. Press Enter to apply, or Esc to cancel."
          : "Player view is read-only for stats and substats."}
      </p>
      <div className="character-sheet__core-blocks">
        {CORE_SUBSTAT_GROUPS.map((group) => {
          const key = group.core;
          const baseValue = stats[key] ?? 0;
          const modifier = getModifier(key);
          const currentValue = getCurrentValue(key, baseValue);
          return (
            <section key={key} className="core-block">
              <header className="core-block__header">
                <div>
                  <span className="core-block__label">{DISPLAY_NAMES[key]}</span>
                </div>
                <div className="core-block__value-wrap">
                  {canEditStats ? (
                    <button className="core-block__value-button" onClick={() => onBeginEditing(key)}>
                      <strong
                        className={`core-block__value ${
                          modifier > 0 ? "stat-value--up" : modifier < 0 ? "stat-value--down" : ""
                        }`}
                      >
                        {currentValue}
                      </strong>
                    </button>
                  ) : (
                    <strong className="core-block__value">{baseValue}</strong>
                  )}
                  <div className="core-block__actions">
                    {canEditStats && modifier !== 0 ? (
                      <>
                        <span
                          className={`stat-modifier ${modifier > 0 ? "stat-modifier--up" : "stat-modifier--down"}`}
                        >
                          {formatModifier(modifier)}
                        </span>
                        <button className="link-button" onClick={() => onResetModifier(key)}>
                          Reset
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </header>

              {canEditStats && editingKey === key ? (
                <div className="stat-editor">
                  <Field label={`${DISPLAY_NAMES[key]} Modifier`}>
                    <input
                      value={draftModifier}
                      onChange={(event) => onDraftModifierChange(event.target.value)}
                      onKeyDown={(event) => onEditorKeyDown(event, key)}
                      inputMode="numeric"
                      placeholder="+10 or -10"
                      aria-label={`${DISPLAY_NAMES[key]} modifier`}
                      autoFocus
                    />
                  </Field>
                  <button className="button" onClick={() => onApplyModifier(key)}>
                    Apply
                  </button>
                  <button className="button button--secondary" onClick={onCancelEditing}>
                    Cancel
                  </button>
                  {editorError ? <p className="error-text stat-editor__error">{editorError}</p> : null}
                  {!editorError ? (
                    <p className="muted stat-editor__hint">Modifier only; base value remains from template.</p>
                  ) : null}
                </div>
              ) : null}

              <div className="core-block__subs">
                {group.subs.map((subKey) => {
                  const subBase = stats[subKey] ?? 0;
                  if (isResourceKey(subKey)) {
                    return (
                      <div key={subKey} className="core-sub-row core-sub-row--base-only">
                        <div className="core-sub-row__top">
                          <div className="core-sub-row__main core-sub-row__main--static">
                            <span className="core-sub-row__label">{DISPLAY_NAMES[subKey]}</span>
                            <span className="core-sub-row__value">{subBase}</span>
                          </div>
                          <div className="core-sub-row__actions core-sub-row__actions--placeholder" />
                        </div>
                      </div>
                    );
                  }

                  const subModifier = getModifier(subKey);
                  const subCurrent = getCurrentValue(subKey, subBase);
                  return (
                    <div key={subKey} className="core-sub-row">
                      <div className="core-sub-row__top">
                        {canEditStats ? (
                          <button className="core-sub-row__main" onClick={() => onBeginEditing(subKey)}>
                            <span className="core-sub-row__label">{DISPLAY_NAMES[subKey]}</span>
                            <span
                              className={`core-sub-row__value ${
                                subModifier > 0 ? "stat-value--up" : subModifier < 0 ? "stat-value--down" : ""
                              }`}
                            >
                              {subCurrent}
                            </span>
                          </button>
                        ) : (
                          <div className="core-sub-row__main core-sub-row__main--static">
                            <span className="core-sub-row__label">{DISPLAY_NAMES[subKey]}</span>
                            <span className="core-sub-row__value">{subBase}</span>
                          </div>
                        )}
                        <div className="core-sub-row__actions">
                          {canEditStats && subModifier !== 0 ? (
                            <>
                              <span
                                className={`stat-modifier ${
                                  subModifier > 0 ? "stat-modifier--up" : "stat-modifier--down"
                                }`}
                              >
                                {formatModifier(subModifier)}
                              </span>
                              <button className="link-button" onClick={() => onResetModifier(subKey)}>
                                Reset
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>

                      {canEditStats && editingKey === subKey ? (
                        <div className="stat-editor stat-editor--sub">
                          <Field label={`${DISPLAY_NAMES[subKey]} Modifier`}>
                            <input
                              value={draftModifier}
                              onChange={(event) => onDraftModifierChange(event.target.value)}
                              onKeyDown={(event) => onEditorKeyDown(event, subKey)}
                              inputMode="numeric"
                              placeholder="+10 or -10"
                              aria-label={`${DISPLAY_NAMES[subKey]} modifier`}
                              autoFocus
                            />
                          </Field>
                          <button className="button" onClick={() => onApplyModifier(subKey)}>
                            Apply
                          </button>
                          <button className="button button--secondary" onClick={onCancelEditing}>
                            Cancel
                          </button>
                          {editorError ? <p className="error-text stat-editor__error">{editorError}</p> : null}
                          {!editorError ? (
                            <p className="muted stat-editor__hint">
                              Modifier only; base value remains from template.
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      {canEditStats ? <p className="muted">Modified stats can be reset back to base.</p> : null}
    </section>
  );
}
