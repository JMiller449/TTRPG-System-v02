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
import { FormulaVariableInput } from "@/features/variables/components/FormulaVariableInput";
import {
  formulaVariableSearchOptions,
  upsertFormulaAlias
} from "@/features/variables/variablePicker";
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
        <p className="muted">
          Set the six core stats. Derived values such as Health and Mana already use the system
          defaults.
        </p>
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
      <div className="template-builder__core-grid">
        {([
          ["Maximum Health Formula", "maxHealth"],
          ["Maximum Mana Formula", "maxMana"]
        ] as const).map(([label, key]) => {
          const resourceFormula = values[key];
          return (
            <FormulaVariableInput
              key={key}
              label={label}
              rows={3}
              value={resourceFormula.text}
              options={formulaVariableSearchOptions(metadata, "sheet")}
              loading={!metadata}
              onChange={(text) =>
                onChange({ ...values, [key]: { ...resourceFormula, text } })
              }
              onVariableSelect={(entry, text) => {
                const alias = toSheetRelativeFormulaAlias(entry);
                if (!alias) {
                  return;
                }
                onChange({
                  ...values,
                  [key]: {
                    ...resourceFormula,
                    text,
                    aliases: upsertFormulaAlias(resourceFormula.aliases ?? null, alias)
                  }
                });
              }}
              placeholder="Type @ to insert a sheet variable"
            />
          );
        })}
      </div>
      <p className="muted">
        Maximum Health uses the racial multiplier; Maximum Mana uses Arcane and the Mana substat.
        Existing variable aliases are preserved when formulas are edited.
      </p>
      <details className="template-builder__advanced-disclosure">
        <summary>
          <span>
            <strong>Customize derived stat formulas</strong>
            <small>Advanced — the defaults are ready to use</small>
          </span>
        </summary>
        <p className="muted">
          Change these only when this template calculates a derived stat differently from the normal
          system rules.
        </p>
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
            <FormulaVariableInput
              label="Formula"
              rows={4}
              value={formula.text}
              options={formulaVariableSearchOptions(metadata, "sheet")}
              loading={!metadata}
              onChange={(text) => updateFormula({ ...formula, text })}
              onVariableSelect={(entry, text) => {
                const alias = toSheetRelativeFormulaAlias(entry);
                if (!alias) {
                  return;
                }
                updateFormula({
                  ...formula,
                  text,
                  aliases: upsertFormulaAlias(formula.aliases ?? null, alias)
                });
              }}
              placeholder="Type @ to insert a sheet variable"
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
              <p className="muted">No additional variable names are configured.</p>
            )}
            <FormulaTagEditor
              tags={formula.tags ?? []}
              onChange={(tags) => updateFormula({ ...formula, tags })}
            />
          </div>
        </div>
      </details>
    </section>
  );
}
