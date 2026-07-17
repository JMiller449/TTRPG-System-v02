import type { FormulaEditorValues } from "@/features/formulas/formulaEditorValues";
import { FormulaTagEditor } from "@/features/formulas/components/FormulaTagEditor";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import { FormulaVariableInput } from "@/features/variables/components/FormulaVariableInput";
import {
  formulaVariableSearchOptions,
  upsertFormulaAlias
} from "@/features/variables/variablePicker";

export function FormulaEditorForm({
  editingFormulaId,
  values,
  onChange,
  onSubmit,
  onCancel,
  metadata
}: {
  editingFormulaId: string | null;
  values: FormulaEditorValues;
  onChange: (values: FormulaEditorValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
  metadata: ActionFormulaAuthoringMetadata | null;
}): JSX.Element {
  return (
    <div className="template-editor formula-editor">
      <p className="template-editor__title">
        {editingFormulaId ? "Edit Formula" : "Create Formula"}
      </p>
      <div className="stack">
        <FormulaVariableInput
          label="Formula"
          rows={4}
          value={values.formulaText}
          options={formulaVariableSearchOptions(metadata)}
          loading={!metadata}
          onChange={(formulaText) => onChange({ ...values, formulaText })}
          onVariableSelect={(entry, formulaText) =>
            onChange({
              ...values,
              formulaText,
              aliases: upsertFormulaAlias(values.aliases, entry.alias)
            })
          }
          placeholder="Type @ to insert a variable"
        />

        <FormulaTagEditor tags={values.tags} onChange={(tags) => onChange({ ...values, tags })} />

        {values.aliases && values.aliases.length > 0 ? (
          <div className="list">
            {values.aliases.map((alias) => (
              <div className="muted" key={`${alias.name}:${alias.path.join(".")}`}>
                {alias.name}: {alias.path.join(".")}
              </div>
            ))}
          </div>
        ) : null}

        <div className="template-editor__actions">
          <button className="button" onClick={onSubmit}>
            {editingFormulaId ? "Save Formula" : "Create Formula"}
          </button>
          {editingFormulaId ? (
            <button className="button button--secondary" onClick={onCancel}>
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
