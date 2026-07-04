import { useState } from "react";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import { DISPLAY_NAMES } from "@/domain/stats";
import { FormulaTagEditor } from "@/features/formulas/components/FormulaTagEditor";
import {
  FORMULA_STAT_KEYS,
  toSheetRelativeFormulaAlias,
  type SheetFormulaStatName
} from "@/features/sheets/sheetDefinitionEditing";
import {
  CORE_STAT_LABELS,
  CORE_TEMPLATE_STATS,
  type TemplateEditorValues
} from "@/features/sheets/templateEditorTypes";
import { VariableSearchPicker } from "@/features/variables/components/VariableSearchPicker";
import { appendFormulaToken, upsertFormulaAlias } from "@/features/variables/variablePicker";
import { Field } from "@/shared/ui/Field";

export function TemplateStatsSection({
  values,
  metadata,
  onChange
}: {
  values: TemplateEditorValues;
  metadata: ActionFormulaAuthoringMetadata | null;
  onChange: (next: TemplateEditorValues) => void;
}): JSX.Element {
  const [selectedFormula, setSelectedFormula] = useState<SheetFormulaStatName>(
    FORMULA_STAT_KEYS[0]
  );
  const formula = values.formulaStats[selectedFormula];
  const updateFormula = (nextFormula: typeof formula): void => {
    onChange({
      ...values,
      formulaStats: { ...values.formulaStats, [selectedFormula]: nextFormula }
    });
  };

  return (
    <section className="template-builder__section stack" aria-labelledby="template-stats-title">
      <div>
        <h3 id="template-stats-title">Stats</h3>
        <p className="muted">Core values are integers. Every substat is an editable formula.</p>
      </div>
      <div className="template-builder__core-grid">
        {CORE_TEMPLATE_STATS.map((key) => (
          <Field key={key} label={CORE_STAT_LABELS[key]}>
            <input
              type="number"
              step="1"
              value={values.coreStats[key]}
              onChange={(event) =>
                onChange({
                  ...values,
                  coreStats: { ...values.coreStats, [key]: event.target.value }
                })
              }
            />
          </Field>
        ))}
      </div>
      <div className="template-builder__formula-workspace">
        <nav className="template-builder__formula-nav" aria-label="Formula stats">
          {FORMULA_STAT_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={key === selectedFormula ? "is-active" : ""}
              aria-pressed={key === selectedFormula}
              onClick={() => setSelectedFormula(key)}
            >
              <span>{DISPLAY_NAMES[key]}</span>
            </button>
          ))}
        </nav>
        <div className="template-builder__formula-editor stack">
          <h4>{DISPLAY_NAMES[selectedFormula]}</h4>
          <Field label="Formula">
            <textarea
              rows={4}
              value={formula.text}
              onChange={(event) => updateFormula({ ...formula, text: event.target.value })}
              placeholder="@constitution * 10"
            />
          </Field>
          <VariableSearchPicker
            metadata={metadata}
            mode="formula"
            root="sheet"
            label="Insert Sheet Variable"
            onPick={(entry) => {
              const alias = toSheetRelativeFormulaAlias(entry);
              if (!alias) {
                return;
              }
              updateFormula({
                ...formula,
                text: appendFormulaToken(formula.text, entry.token),
                aliases: upsertFormulaAlias(formula.aliases ?? null, alias)
              });
            }}
          />
          {(formula.aliases ?? []).length > 0 ? (
            <div className="formula-tag-list" aria-label="Formula aliases">
              {formula.aliases?.map((alias) => (
                <button
                  className="formula-tag"
                  type="button"
                  key={alias.name}
                  onClick={() => {
                    const aliases = (formula.aliases ?? []).filter(
                      (candidate) => candidate.name !== alias.name
                    );
                    updateFormula({ ...formula, aliases: aliases.length > 0 ? aliases : null });
                  }}
                >
                  @{alias.name}: {alias.path.join(".")} ×
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">No variable aliases.</p>
          )}
          <FormulaTagEditor
            tags={formula.tags ?? []}
            onChange={(tags) => updateFormula({ ...formula, tags })}
          />
        </div>
      </div>
    </section>
  );
}
