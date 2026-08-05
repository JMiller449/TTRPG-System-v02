import type { KeyboardEvent } from "react";
import type { Formula } from "@/domain/models";
import { Field } from "@/shared/ui/Field";
import {
  CORE_SUBSTAT_GROUPS,
  DISPLAY_NAMES,
  formatModifier,
  isResourceKey,
  type SheetStatKey
} from "@/features/sheets/sheetDisplay";
import type { SheetFormulaStatName } from "@/features/sheets/sheetDefinitionEditing";

export function SheetStatsSection({
  canEditStats,
  compact = false,
  stats,
  formulaStats,
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
  onEditorKeyDown,
  onEditFormulaStat
}: {
  canEditStats: boolean;
  compact?: boolean;
  stats: Partial<Record<SheetStatKey, number>>;
  formulaStats?: Partial<Record<SheetFormulaStatName, Formula>>;
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
  onEditFormulaStat?: (statName: SheetFormulaStatName) => void;
}): JSX.Element {
  return (
    <section
      className={`character-sheet__section ${compact ? "character-sheet__section--compact" : ""}`}
    >
      <h4>{compact ? "Stats" : "Core Stats and Related Substats"}</h4>
      {!compact ? (
        <p className="muted character-sheet__hint">
          {canEditStats
            ? "Click a core stat to change its value. Hover over a derived stat to inspect its formula, or click it to edit."
            : "These values come straight from the server and update live."}
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
                  const subBase = stats[subKey];
                  const displaySubBase = subBase ?? "—";
                  const formula = formulaStats?.[subKey];
                  const tooltipId = `formula-tooltip-${subKey}`;
                  const aliases = formula?.aliases ?? [];
                  const aliasSummary =
                    aliases.length > 0
                      ? aliases
                          .map((alias) => `@${alias.name} → ${alias.path.join(".")}`)
                          .join(", ")
                      : "No aliases configured";
                  const formulaContent = formula ? (
                    <span className="formula-stat-tooltip" id={tooltipId} role="tooltip">
                      <span>
                        Formula: <code>{formula.text}</code>
                      </span>
                      <span>{aliasSummary}</span>
                    </span>
                  ) : null;
                  const canEditFormula = canEditStats && Boolean(formula) && onEditFormulaStat;
                  return (
                    <div
                      key={subKey}
                      className={`core-sub-row ${isResourceKey(subKey) ? "core-sub-row--base-only" : ""}`}
                    >
                      <div className="core-sub-row__top">
                        {canEditFormula ? (
                          <button
                            type="button"
                            className="core-sub-row__main core-sub-row__main--formula"
                            onClick={() => onEditFormulaStat(subKey)}
                            aria-label={`Edit ${DISPLAY_NAMES[subKey]} formula. Current value ${displaySubBase}.`}
                            aria-describedby={tooltipId}
                          >
                            <span className="core-sub-row__label">{DISPLAY_NAMES[subKey]}</span>
                            <span className="core-sub-row__value">{displaySubBase}</span>
                            {formulaContent}
                          </button>
                        ) : (
                          <div
                            className={`core-sub-row__main core-sub-row__main--static ${formula ? "core-sub-row__main--formula" : ""}`}
                            tabIndex={formula ? 0 : undefined}
                            aria-describedby={formula ? tooltipId : undefined}
                          >
                            <span className="core-sub-row__label">{DISPLAY_NAMES[subKey]}</span>
                            <span className="core-sub-row__value">{displaySubBase}</span>
                            {formulaContent}
                          </div>
                        )}
                        <div className="core-sub-row__actions core-sub-row__actions--placeholder" />
                      </div>
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
