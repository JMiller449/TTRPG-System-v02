import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import type { FormulaDefinition } from "@/domain/models";
import type { AugmentationEditorValues } from "@/features/augmentations/augmentationEditorValues";
import { CatalogEntityPicker } from "@/features/catalogs/CatalogEntityPicker";
import { FormulaVariableInput } from "@/features/variables/components/FormulaVariableInput";
import {
  formulaVariableSearchOptions,
  upsertFormulaAlias
} from "@/features/variables/variablePicker";

export function EffectFormulaEditor({
  values,
  formulas,
  metadata,
  validationAttempted,
  onChange
}: {
  values: AugmentationEditorValues;
  formulas: FormulaDefinition[];
  metadata: ActionFormulaAuthoringMetadata | null;
  validationAttempted: boolean;
  onChange: (values: AugmentationEditorValues) => void;
}): JSX.Element {
  const selectedSource = values.formulaId.trim() ? `global:${values.formulaId.trim()}` : "inline";
  const selectedFormula = formulas.find((formula) => formula.id === values.formulaId.trim());
  const formulaMissing = Boolean(values.formulaId.trim()) && !selectedFormula;

  return (
    <section className="effect-formula-editor stack" aria-label="Effect value formula">
      <CatalogEntityPicker
        catalog="formulas"
        label="Value source"
        placeholder="Choose custom or shared formula"
        selectedId={selectedSource}
        options={[
          {
            id: "inline",
            label: "Custom value or formula",
            secondary: "Enter it here and use @ to insert character values",
            value: "inline"
          },
          ...(formulaMissing
            ? [
                {
                  id: selectedSource,
                  label: `Missing shared formula: ${values.formulaId.trim()}`,
                  disabledReason: "Missing definition",
                  value: selectedSource
                }
              ]
            : []),
          ...formulas.map((formula) => ({
            id: `global:${formula.id}`,
            label: formula.id,
            secondary: formula.formula.text,
            organizationEntryId: formula.id,
            value: `global:${formula.id}`
          }))
        ]}
        onSelect={(source) => {
          if (source === "inline") {
            onChange({ ...values, formulaId: "" });
            return;
          }
          onChange({ ...values, formulaId: source.replace(/^global:/, "") });
        }}
      />

      {values.formulaId.trim() ? (
        <div className="effect-shared-formula">
          <span>
            <strong>Shared formula</strong>
            <code>{selectedFormula?.formula.text ?? values.formulaId.trim()}</code>
          </span>
          <button
            className="button button--secondary"
            type="button"
            disabled={!selectedFormula}
            onClick={() => {
              if (!selectedFormula) {
                return;
              }
              onChange({
                ...values,
                formulaId: "",
                formulaText: selectedFormula.formula.text,
                formulaAliases:
                  selectedFormula.formula.aliases?.map((alias) => ({
                    ...alias,
                    path: [...alias.path]
                  })) ?? null
              });
            }}
          >
            Customize here
          </button>
        </div>
      ) : (
        <>
          <FormulaVariableInput
            label="Value or formula"
            value={values.formulaText}
            options={formulaVariableSearchOptions(metadata)}
            loading={!metadata}
            multiline={false}
            required
            ariaInvalid={validationAttempted && !values.formulaText.trim()}
            onChange={(formulaText) => onChange({ ...values, formulaText })}
            onVariableSelect={(entry, formulaText) =>
              onChange({
                ...values,
                formulaText,
                formulaAliases: upsertFormulaAlias(values.formulaAliases, entry.alias)
              })
            }
            placeholder="e.g. 2, 0.5, or @health / 10"
          />
          <p className="muted effect-formula-editor__hint">
            Enter a number for a quick modifier. Type <code>@</code> to insert an authoritative
            character value. This custom formula is saved automatically with the effect.
          </p>
        </>
      )}
    </section>
  );
}
