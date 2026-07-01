import type { FormulaDefinition } from "@/domain/models";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import {
  boundedMutationPrimarySource,
  calculatedValuesBeforeStep,
  isCalculatedValueReference,
  isFormulaReference,
  isInlineFormula,
  setBoundedMutationSource,
  updateBoundedMutationFormula,
  updateBoundedMutationSettings,
  type ActionEditorValues,
  type BoundedMutationEditorStep,
  type BoundedMutationSourceSlot,
  type EditorNumericValueSource
} from "@/features/actions/actionEditorValues";
import { FormulaTagEditor } from "@/features/formulas/components/FormulaTagEditor";
import { VariableSearchPicker } from "@/features/variables/components/VariableSearchPicker";
import {
  appendFormulaToken,
  upsertFormulaAlias,
  type VariablePickerEntry
} from "@/features/variables/variablePicker";
import { Field } from "@/shared/ui/Field";

function operationLabel(step: BoundedMutationEditorStep): string {
  if (step.type === "set_value") {
    return "Set";
  }
  return step.type === "increment_value" ? "Increase" : "Decrease";
}

export function ActionBoundedMutationStepEditor({
  step,
  values,
  onChange,
  metadata,
  mutationTargets,
  formulas
}: {
  step: BoundedMutationEditorStep;
  values: ActionEditorValues;
  onChange: (values: ActionEditorValues) => void;
  metadata: ActionFormulaAuthoringMetadata | null;
  mutationTargets: VariablePickerEntry[];
  formulas: FormulaDefinition[];
}): JSX.Element {
  const label = operationLabel(step);
  const calculatedValues = calculatedValuesBeforeStep(values, step.step_id);
  const primarySource = boundedMutationPrimarySource(step);

  const setSourceFromSelection = (slot: BoundedMutationSourceSlot, selection: string): void => {
    let source: EditorNumericValueSource = { aliases: null, text: "" };
    if (selection.startsWith("global:")) {
      source = {
        type: "formula_reference",
        formula_id: selection.slice("global:".length)
      };
    } else if (selection.startsWith("calculated:")) {
      source = {
        type: "calculated_value",
        variable_id: selection.slice("calculated:".length)
      };
    }
    onChange(setBoundedMutationSource(values, step.step_id, slot, source));
  };

  const insertCalculatedValue = (
    slot: BoundedMutationSourceSlot,
    source: EditorNumericValueSource,
    variableId: string
  ): void => {
    if (!isInlineFormula(source)) {
      return;
    }
    const alias = { name: variableId, path: ["action_values", variableId] };
    onChange(
      updateBoundedMutationFormula(values, step.step_id, slot, {
        text: appendFormulaToken(source.text, `@${variableId}`),
        aliases: upsertFormulaAlias(source.aliases ?? null, alias)
      })
    );
  };

  const sourceEditor = (
    slot: BoundedMutationSourceSlot,
    source: EditorNumericValueSource,
    sourceLabel: string
  ): JSX.Element => {
    const formulaId = isFormulaReference(source) ? source.formula_id : null;
    const variableId = isCalculatedValueReference(source) ? source.variable_id : null;
    return (
      <div className="stack">
        <Field label={`${sourceLabel} Source`}>
          <select
            value={
              formulaId ? `global:${formulaId}` : variableId ? `calculated:${variableId}` : "inline"
            }
            onChange={(event) => setSourceFromSelection(slot, event.target.value)}
          >
            <option value="inline">Inline formula</option>
            {formulaId && !formulas.some((formula) => formula.id === formulaId) ? (
              <option value={`global:${formulaId}`} disabled>
                Missing global formula: {formulaId}
              </option>
            ) : null}
            {formulas.map((formula) => (
              <option key={formula.id} value={`global:${formula.id}`}>
                Global: {formula.id}
              </option>
            ))}
            {variableId && !calculatedValues.some((option) => option.variableId === variableId) ? (
              <option value={`calculated:${variableId}`} disabled>
                Unavailable: {variableId}
              </option>
            ) : null}
            {calculatedValues.map((option) => (
              <option key={option.stepId} value={`calculated:${option.variableId}`}>
                Calculated: {option.variableId}
              </option>
            ))}
          </select>
        </Field>
        {isInlineFormula(source) ? (
          <>
            <Field label={`${sourceLabel} Formula`}>
              <input
                value={source.text}
                onChange={(event) =>
                  onChange(
                    updateBoundedMutationFormula(values, step.step_id, slot, {
                      text: event.target.value
                    })
                  )
                }
                placeholder="e.g. 1d8 + 2"
              />
            </Field>
            <VariableSearchPicker
              metadata={metadata}
              mode="formula"
              label={`Insert ${sourceLabel} Variable`}
              onPick={(entry) => {
                if (!isInlineFormula(source)) {
                  return;
                }
                onChange(
                  updateBoundedMutationFormula(values, step.step_id, slot, {
                    text: appendFormulaToken(source.text, entry.token),
                    aliases: upsertFormulaAlias(source.aliases ?? null, entry.alias)
                  })
                );
              }}
            />
            {calculatedValues.length > 0 ? (
              <Field label="Earlier Calculated Value in Formula">
                <select
                  value=""
                  onChange={(event) => {
                    if (event.target.value) {
                      insertCalculatedValue(slot, source, event.target.value);
                    }
                  }}
                >
                  <option value="">Insert a previous calculated value</option>
                  {calculatedValues.map((option) => (
                    <option key={option.stepId} value={option.variableId}>
                      {option.variableId} ({option.stepId})
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            <FormulaTagEditor
              label={`${sourceLabel} Formula Tags`}
              tags={source.tags ?? []}
              onChange={(tags) =>
                onChange(updateBoundedMutationFormula(values, step.step_id, slot, { tags }))
              }
            />
          </>
        ) : isFormulaReference(source) ? (
          <p className="muted">Uses global formula {source.formula_id} by ID.</p>
        ) : (
          <p className="muted">
            Reuses {source.variable_id} directly without reevaluating its formula.
          </p>
        )}
      </div>
    );
  };

  const boundEditor = (
    slot: "min_value" | "max_value",
    boundLabel: "Minimum" | "Maximum"
  ): JSX.Element => {
    const source = step[slot];
    if (!source) {
      return (
        <button
          className="button button--secondary"
          onClick={() =>
            onChange(
              setBoundedMutationSource(values, step.step_id, slot, {
                aliases: null,
                text: "0"
              })
            )
          }
        >
          Add {boundLabel}
        </button>
      );
    }
    const violation = slot === "min_value" ? step.on_min_violation : step.on_max_violation;
    return (
      <div className="list-item list-item--block">
        {sourceEditor(slot, source, boundLabel)}
        <Field label={`${boundLabel} Violation`}>
          <select
            value={violation ?? "clamp"}
            onChange={(event) =>
              onChange(
                updateBoundedMutationSettings(values, step.step_id, {
                  ...(slot === "min_value"
                    ? { onMinViolation: event.target.value as "clamp" | "reject" }
                    : { onMaxViolation: event.target.value as "clamp" | "reject" })
                })
              )
            }
          >
            <option value="clamp">Clamp to bound</option>
            <option value="reject">Reject action</option>
          </select>
        </Field>
        <button
          className="button button--secondary"
          onClick={() => onChange(setBoundedMutationSource(values, step.step_id, slot, null))}
        >
          Remove {boundLabel}
        </button>
      </div>
    );
  };

  return (
    <div className="list-item list-item--block">
      <Field label={`${label} Target: ${step.step_id}`}>
        <select
          value={step.path.join(".")}
          onChange={(event) => {
            const target = mutationTargets.find(
              (entry) => entry.path.join(".") === event.target.value
            );
            if (target) {
              onChange(updateBoundedMutationSettings(values, step.step_id, { path: target.path }));
            }
          }}
        >
          {mutationTargets.some((entry) => entry.path.join(".") === step.path.join(".")) ? null : (
            <option value={step.path.join(".")} disabled>
              Unavailable: {step.path.join(".")}
            </option>
          )}
          {mutationTargets.map((target) => (
            <option key={target.key} value={target.path.join(".")}>
              {target.label}
            </option>
          ))}
        </select>
      </Field>
      {sourceEditor("primary", primarySource, step.type === "set_value" ? "Value" : "Amount")}
      <div className="inline-group">
        {boundEditor("min_value", "Minimum")}
        {boundEditor("max_value", "Maximum")}
      </div>
    </div>
  );
}
