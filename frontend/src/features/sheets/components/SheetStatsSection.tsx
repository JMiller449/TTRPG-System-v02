import type { KeyboardEvent } from "react";
import { Field } from "@/shared/ui/Field";
import {
  CORE_SUBSTAT_GROUPS,
  DISPLAY_NAMES,
  formatModifier,
  isCoreStatKey,
  isResourceKey,
  type SheetStatKey
} from "@/features/sheets/sheetDisplay";

export function SheetStatsSection({
  canEditStats,
  compact = false,
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
  compact?: boolean;
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
    <section
      className={`character-sheet__section ${compact ? "character-sheet__section--compact" : ""}`}
    >
      <h4>{compact ? "Stats" : "Core Stats and Related Substats"}</h4>
      {!compact ? (
        <p className="muted character-sheet__hint">
          {canEditStats
            ? "GM stat edits are backend-authored. Formula and resistance controls stay below the table."
            : "Read-only values from the authoritative sheet."}
        </p>
      ) : null}
      <div className="character-sheet__core-blocks">
        {CORE_SUBSTAT_GROUPS.map((group) => {
          const key = group.core;
          const baseValue = stats[key] ?? 0;
          const modifier = getModifier(key);
          const currentValue = getCurrentValue(key, baseValue);
          const editorId = `stat-editor-${key}`;
          const errorId = `${editorId}-error`;
          const hintId = `${editorId}-hint`;
          return (
            <section key={key} className="core-block">
              <header className="core-block__header">
                <div>
                  <span className="core-block__label">{DISPLAY_NAMES[key]}</span>
                </div>
                <div className="core-block__value-wrap">
                  {canEditStats ? (
                    <button
                      type="button"
                      className="core-block__value-button"
                      onClick={() => onBeginEditing(key)}
                      aria-label={`Edit ${DISPLAY_NAMES[key]}. Current value ${currentValue}.`}
                      aria-expanded={editingKey === key}
                      aria-controls={editorId}
                    >
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
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => onResetModifier(key)}
                          aria-label={`Reset ${DISPLAY_NAMES[key]} modifier`}
                        >
                          Reset
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </header>

              {canEditStats && editingKey === key ? (
                <div
                  className="stat-editor"
                  id={editorId}
                  role="group"
                  aria-label={`Edit ${DISPLAY_NAMES[key]}`}
                >
                  <Field label={`${DISPLAY_NAMES[key]} Modifier`}>
                    <input
                      value={draftModifier}
                      onChange={(event) => onDraftModifierChange(event.target.value)}
                      onKeyDown={(event) => onEditorKeyDown(event, key)}
                      inputMode="numeric"
                      placeholder="+10 or -10"
                      aria-label={`${DISPLAY_NAMES[key]} modifier`}
                      aria-describedby={editorError ? errorId : hintId}
                      aria-invalid={Boolean(editorError)}
                      autoFocus
                    />
                  </Field>
                  <button type="button" className="button" onClick={() => onApplyModifier(key)}>
                    Apply
                  </button>
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={onCancelEditing}
                  >
                    Cancel
                  </button>
                  {editorError ? (
                    <p className="error-text stat-editor__error" id={errorId} role="alert">
                      {editorError}
                    </p>
                  ) : (
                    <p className="muted stat-editor__hint" id={hintId}>
                      Updates template base stat.
                    </p>
                  )}
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

                  const canEditSubStat = canEditStats && isCoreStatKey(subKey);
                  const subModifier = getModifier(subKey);
                  const subCurrent = getCurrentValue(subKey, subBase);
                  const subEditorId = `stat-editor-${subKey}`;
                  const subErrorId = `${subEditorId}-error`;
                  const subHintId = `${subEditorId}-hint`;
                  return (
                    <div key={subKey} className="core-sub-row">
                      <div className="core-sub-row__top">
                        {canEditSubStat ? (
                          <button
                            type="button"
                            className="core-sub-row__main"
                            onClick={() => onBeginEditing(subKey)}
                            aria-label={`Edit ${DISPLAY_NAMES[subKey]}. Current value ${subCurrent}.`}
                            aria-expanded={editingKey === subKey}
                            aria-controls={subEditorId}
                          >
                            <span className="core-sub-row__label">{DISPLAY_NAMES[subKey]}</span>
                            <span
                              className={`core-sub-row__value ${
                                subModifier > 0
                                  ? "stat-value--up"
                                  : subModifier < 0
                                    ? "stat-value--down"
                                    : ""
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
                          {canEditSubStat && subModifier !== 0 ? (
                            <>
                              <span
                                className={`stat-modifier ${
                                  subModifier > 0 ? "stat-modifier--up" : "stat-modifier--down"
                                }`}
                              >
                                {formatModifier(subModifier)}
                              </span>
                              <button
                                type="button"
                                className="link-button"
                                onClick={() => onResetModifier(subKey)}
                                aria-label={`Reset ${DISPLAY_NAMES[subKey]} modifier`}
                              >
                                Reset
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>

                      {canEditSubStat && editingKey === subKey ? (
                        <div
                          className="stat-editor stat-editor--sub"
                          id={subEditorId}
                          role="group"
                          aria-label={`Edit ${DISPLAY_NAMES[subKey]}`}
                        >
                          <Field label={`${DISPLAY_NAMES[subKey]} Modifier`}>
                            <input
                              value={draftModifier}
                              onChange={(event) => onDraftModifierChange(event.target.value)}
                              onKeyDown={(event) => onEditorKeyDown(event, subKey)}
                              inputMode="numeric"
                              placeholder="+10 or -10"
                              aria-label={`${DISPLAY_NAMES[subKey]} modifier`}
                              aria-describedby={editorError ? subErrorId : subHintId}
                              aria-invalid={Boolean(editorError)}
                              autoFocus
                            />
                          </Field>
                          <button
                            type="button"
                            className="button"
                            onClick={() => onApplyModifier(subKey)}
                          >
                            Apply
                          </button>
                          <button
                            type="button"
                            className="button button--secondary"
                            onClick={onCancelEditing}
                          >
                            Cancel
                          </button>
                          {editorError ? (
                            <p
                              className="error-text stat-editor__error"
                              id={subErrorId}
                              role="alert"
                            >
                              {editorError}
                            </p>
                          ) : (
                            <p className="muted stat-editor__hint" id={subHintId}>
                              Updates template base stat.
                            </p>
                          )}
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
    </section>
  );
}
