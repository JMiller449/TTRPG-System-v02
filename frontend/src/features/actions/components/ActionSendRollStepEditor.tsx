import { useEffect, useState } from "react";
import type { FormulaAlias, FormulaDefinition } from "@/domain/models";
import {
  isFormulaReference,
  isInlineFormula,
  updateSendRollActionStep,
  type ActionEditorValues,
  type SendRollEditorStep
} from "@/features/actions/actionEditorValues";
import { FormulaTagEditor } from "@/features/formulas/components/FormulaTagEditor";
import { FormulaVariableInput } from "@/features/variables/components/FormulaVariableInput";
import { upsertFormulaAlias } from "@/features/variables/variablePicker";
import { CatalogEntityPicker } from "@/features/catalogs/CatalogEntityPicker";
import { Field } from "@/shared/ui/Field";
import type { SearchPopoverOption } from "@/shared/ui/searchPopover";

type FormulaOptions = SearchPopoverOption<{ token: string; alias: FormulaAlias }>[];

function resultRole(index: number): "Primary" | "Secondary" {
  return index === 0 ? "Primary" : "Secondary";
}

export function ActionSendRollStepEditor({
  step,
  values,
  onChange,
  formulas,
  formulaOptions,
  loading,
  validationAttempted
}: {
  step: SendRollEditorStep;
  values: ActionEditorValues;
  onChange: (values: ActionEditorValues) => void;
  formulas: FormulaDefinition[];
  formulaOptions: FormulaOptions;
  loading: boolean;
  validationAttempted: boolean;
}): JSX.Element {
  const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(null);
  const selectedResult =
    selectedResultIndex === null ? null : (step.rolls[selectedResultIndex] ?? null);

  useEffect(() => {
    if (selectedResultIndex === null || step.rolls[selectedResultIndex]) {
      return;
    }
    setSelectedResultIndex(null);
  }, [selectedResultIndex, step.rolls]);

  const updateRolls = (rolls: SendRollEditorStep["rolls"]): void => {
    onChange(updateSendRollActionStep(values, step.step_id, { rolls }));
  };

  const formulaSummary = (roll: SendRollEditorStep["rolls"][number]): string => {
    if (isFormulaReference(roll.value)) {
      return `Shared formula: ${roll.value.formula_id}`;
    }
    return roll.value.text.trim() || "Empty inline formula";
  };

  if (selectedResult && selectedResultIndex !== null) {
    const role = resultRole(selectedResultIndex);
    const selectedFormulaId = isFormulaReference(selectedResult.value)
      ? selectedResult.value.formula_id
      : null;
    const selectedFormula = selectedFormulaId
      ? formulas.find((formula) => formula.id === selectedFormulaId)
      : null;
    return (
      <div className="stack action-roll-result-editor">
        <div className="action-roll-result-editor__navigation">
          <button
            className="button button--secondary"
            type="button"
            onClick={() => setSelectedResultIndex(null)}
          >
            Back to Styled Roll
          </button>
          <span>
            <strong>{role} Result</strong>
            <small className="muted">Configure this card result and its formula.</small>
          </span>
        </div>

        <div className="action-roll-result-editor__settings">
          <Field
            label={`${role} Result Label`}
            required
            invalid={validationAttempted && !selectedResult.label.trim()}
          >
            <input
              value={selectedResult.label}
              required
              aria-invalid={validationAttempted && !selectedResult.label.trim()}
              onChange={(event) => {
                const rolls = structuredClone(step.rolls);
                rolls[selectedResultIndex] = {
                  ...rolls[selectedResultIndex],
                  label: event.target.value
                };
                updateRolls(rolls);
              }}
            />
          </Field>
          <CatalogEntityPicker
            catalog="formulas"
            label="Formula Source"
            placeholder="Search formula catalog"
            selectedId={selectedFormulaId ? `global:${selectedFormulaId}` : "inline"}
            options={[
              { id: "inline", label: "Inline formula", value: "inline" },
              ...(selectedFormulaId && !selectedFormula
                ? [
                    {
                      id: `global:${selectedFormulaId}`,
                      label: `Missing global formula: ${selectedFormulaId}`,
                      organizationEntryId: selectedFormulaId,
                      disabledReason: "Missing definition",
                      value: `global:${selectedFormulaId}`
                    }
                  ]
                : []),
              ...formulas.map((formula) => ({
                id: `global:${formula.id}`,
                label: formula.id,
                secondary: formula.formula.text,
                keywords: [formula.id, "global"],
                organizationEntryId: formula.id,
                value: `global:${formula.id}`
              }))
            ]}
            emptyMessage="No formula sources available."
            onSelect={(sourceId) => {
              const rolls = structuredClone(step.rolls);
              const formulaId = sourceId.startsWith("global:")
                ? sourceId.slice("global:".length)
                : null;
              rolls[selectedResultIndex] = {
                ...rolls[selectedResultIndex],
                value: formulaId
                  ? { type: "formula_reference", formula_id: formulaId }
                  : { aliases: null, text: "" }
              };
              updateRolls(rolls);
            }}
          />
        </div>

        {isInlineFormula(selectedResult.value) ? (
          <>
            <FormulaVariableInput
              label="Formula"
              rows={2}
              value={selectedResult.value.text}
              options={formulaOptions}
              loading={loading}
              onChange={(text) => {
                const rolls = structuredClone(step.rolls);
                rolls[selectedResultIndex] = {
                  ...rolls[selectedResultIndex],
                  value: { ...selectedResult.value, text }
                };
                updateRolls(rolls);
              }}
              onVariableSelect={(entry, text) => {
                if (!isInlineFormula(selectedResult.value)) {
                  return;
                }
                const rolls = structuredClone(step.rolls);
                rolls[selectedResultIndex] = {
                  ...rolls[selectedResultIndex],
                  value: {
                    ...selectedResult.value,
                    text,
                    aliases: upsertFormulaAlias(selectedResult.value.aliases ?? null, entry.alias)
                  }
                };
                updateRolls(rolls);
              }}
              placeholder="Type @ to insert a variable"
            />
            <FormulaTagEditor
              label="Formula Tags"
              tags={selectedResult.value.tags ?? []}
              onChange={(tags) => {
                const rolls = structuredClone(step.rolls);
                rolls[selectedResultIndex] = {
                  ...selectedResult,
                  value: { ...selectedResult.value, tags }
                };
                updateRolls(rolls);
              }}
            />
          </>
        ) : (
          <p className="muted">
            {selectedFormula
              ? `Uses shared formula: ${selectedFormula.formula.text}`
              : "Uses a shared formula that has since been deleted."}
          </p>
        )}

        {selectedResultIndex > 0 ? (
          <div className="action-roll-result-editor__actions">
            <button
              className="button button--secondary"
              type="button"
              onClick={() => {
                updateRolls(step.rolls.filter((_, index) => index !== selectedResultIndex));
                setSelectedResultIndex(null);
              }}
            >
              Remove Secondary Result
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  const supportsSecondaryResult = (step.presentation ?? "default") !== "simple";
  return (
    <div className="stack action-roll-step-editor">
      <div className="action-roll-step-editor__settings">
        <Field label="Roll Title" required invalid={validationAttempted && !step.title.trim()}>
          <input
            value={step.title}
            required
            aria-invalid={validationAttempted && !step.title.trim()}
            onChange={(event) =>
              onChange(
                updateSendRollActionStep(values, step.step_id, { title: event.target.value })
              )
            }
          />
        </Field>
        <Field label="Roll20 Card">
          <select
            value={step.presentation ?? "default"}
            onChange={(event) => {
              const presentation = event.target.value as typeof step.presentation;
              onChange(
                updateSendRollActionStep(values, step.step_id, {
                  presentation,
                  rolls: presentation === "simple" ? step.rolls.slice(0, 1) : step.rolls
                })
              );
            }}
          >
            <option value="simple">Check / simple</option>
            <option value="damage">Damage</option>
            <option value="default">Portable default</option>
          </select>
        </Field>
      </div>

      <section className="action-roll-results stack">
        <div className="action-roll-results__heading">
          <span>
            <strong>Card Results</strong>
            <small className="muted">
              {supportsSecondaryResult
                ? "This card supports a primary result and one optional secondary result."
                : "Simple cards show exactly one primary result."}
            </small>
          </span>
          {supportsSecondaryResult && step.rolls.length < 2 ? (
            <button
              className="button button--secondary"
              type="button"
              onClick={() => {
                updateRolls([
                  ...step.rolls,
                  { label: "Secondary", value: { aliases: null, text: "0" } }
                ]);
                setSelectedResultIndex(1);
              }}
            >
              Add Secondary Result
            </button>
          ) : null}
        </div>
        <div className="action-roll-results__list">
          {step.rolls.map((roll, index) => (
            <article className="action-roll-result-card" key={`${step.step_id}-${index}`}>
              <span>
                <strong>{resultRole(index)} Result</strong>
                <small className="muted">
                  {roll.label.trim() || "Unlabeled"} · {formulaSummary(roll)}
                </small>
              </span>
              <button
                className="button"
                type="button"
                onClick={() => setSelectedResultIndex(index)}
              >
                Edit
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
