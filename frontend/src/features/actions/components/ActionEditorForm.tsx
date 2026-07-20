import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Field } from "@/shared/ui/Field";
import {
  DAMAGE_TYPES,
  type ConditionPreset,
  type DamageType,
  type FormulaDefinition,
  type ProficiencyDefinition,
  type StandaloneEffectDefinition
} from "@/domain/models";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import {
  calculatedValuesBeforeStep,
  duplicateActionStep,
  isCalculatedValueReference,
  isFormulaReference,
  isInlineFormula,
  moveActionStep,
  removeActionStep,
  setNumericStepCalculatedValue,
  setActionStepFormulaReference,
  updateCalculateValueActionStep,
  updateGainProficiencyUseActionStep,
  updateGainProficiencyUseActionStepFormula,
  updateResolveDamageActionStep,
  updateResolveDamageActionStepFormula,
  updateSendMessageActionStepText,
  updateSendMessageActionStepFormula,
  updateSendRollActionStep,
  type ActionEditorValues,
  type ResolveDamageEditorStep
} from "@/features/actions/actionEditorValues";
import {
  actionStepIdPrefix,
  actionStepLabel,
  addActionStepFromMenu,
  buildActionStepMenuOptions,
  type ActionStepMenuGroup,
  type ActionStepMenuType
} from "@/features/actions/actionStepMenu";
import { ActionBoundedMutationStepEditor } from "@/features/actions/components/ActionBoundedMutationStepEditor";
import { ActionRecordStepEditor } from "@/features/actions/components/ActionRecordStepEditor";
import { FormulaVariableInput } from "@/features/variables/components/FormulaVariableInput";
import {
  buildVariablePickerEntries,
  formulaVariableSearchOptions,
  upsertFormulaAlias,
} from "@/features/variables/variablePicker";
import { makeId } from "@/shared/utils/id";
import { FormulaTagEditor } from "@/features/formulas/components/FormulaTagEditor";

const ACTION_STEP_GROUPS: readonly ActionStepMenuGroup[] = [
  "Calculation & Output",
  "State Changes",
  "Rules & Effects"
];

export function ActionEditorForm({
  editingActionId,
  values,
  onChange,
  onSubmit,
  onCancel,
  metadata,
  proficiencies,
  formulas,
  standaloneEffects,
  conditions,
  attributesEditor,
  validationError,
  showValidationError = true,
  pending = false
}: {
  editingActionId: string | null;
  values: ActionEditorValues;
  onChange: (values: ActionEditorValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
  metadata: ActionFormulaAuthoringMetadata | null;
  proficiencies: ProficiencyDefinition[];
  formulas: FormulaDefinition[];
  standaloneEffects: StandaloneEffectDefinition[];
  conditions: ConditionPreset[];
  attributesEditor: ReactNode;
  validationError: string | null;
  showValidationError?: boolean;
  pending?: boolean;
}): JSX.Element {
  const defaultProficiencyId = proficiencies[0]?.id ?? "";
  const mutationTargets = buildVariablePickerEntries(metadata, "mutation").filter(
    (entry) => entry.root === "instance"
  );
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [stepTypeToAdd, setStepTypeToAdd] = useState<ActionStepMenuType>("send_message");
  const stepDependencies = {
    mutationTargetPath: mutationTargets[0]?.path,
    proficiencyId: defaultProficiencyId || undefined,
    augmentationId: standaloneEffects[0]?.id,
    conditionId: conditions[0]?.id
  };
  const stepMenuOptions = buildActionStepMenuOptions(stepDependencies);
  const selectedMenuOption = stepMenuOptions.find((option) => option.type === stepTypeToAdd);
  const actionIsValid = validationError === null;

  useEffect(() => {
    if (selectedStepId && values.steps.some((step) => step.step_id === selectedStepId)) {
      return;
    }
    setSelectedStepId(values.steps[0]?.step_id ?? null);
  }, [selectedStepId, values.steps]);

  const addSelectedStep = (): void => {
    if (selectedMenuOption?.unavailableReason) {
      return;
    }
    const stepId = makeId(actionStepIdPrefix(stepTypeToAdd));
    const nextValues = addActionStepFromMenu({
      values,
      type: stepTypeToAdd,
      stepId,
      dependencies: stepDependencies
    });
    if (!nextValues) {
      return;
    }
    onChange(nextValues);
    setSelectedStepId(stepId);
  };

  const formulaMentionOptions = (stepId: string) => [
    ...formulaVariableSearchOptions(metadata),
    ...calculatedValuesBeforeStep(values, stepId).map((option) => ({
      id: `calculated:${option.stepId}:${option.variableId}`,
      label: option.variableId,
      secondary: `@${option.variableId} | earlier calculated value`,
      keywords: [option.variableId, option.stepId, "calculated"],
      value: {
        token: `@${option.variableId}`,
        alias: { name: option.variableId, path: ["action_values", option.variableId] }
      }
    }))
  ];

  const sharedFormulaHint = (formulaId: string): JSX.Element => {
    const definition = formulas.find((formula) => formula.id === formulaId);
    return (
      <p className="muted">
        {definition
          ? `Uses shared formula: ${definition.formula.text}`
          : "Uses a shared formula that has since been deleted."}
      </p>
    );
  };

  const formulaSourcePicker = (
    stepId: string,
    source: ResolveDamageEditorStep["amount"],
    { allowCalculated = false, label = "Formula Source" } = {}
  ): JSX.Element => {
    const options = calculatedValuesBeforeStep(values, stepId);
    const currentVariable = isCalculatedValueReference(source) ? source.variable_id : null;
    const currentFormulaId = isFormulaReference(source) ? source.formula_id : null;
    return (
      <Field label={label}>
        <select
          value={
            currentVariable
              ? `calculated:${currentVariable}`
              : currentFormulaId
                ? `global:${currentFormulaId}`
                : "inline"
          }
          onChange={(event) => {
            const value = event.target.value;
            if (value.startsWith("calculated:")) {
              onChange(
                setNumericStepCalculatedValue(values, stepId, value.slice("calculated:".length))
              );
              return;
            }
            onChange(
              setActionStepFormulaReference(
                values,
                stepId,
                value.startsWith("global:") ? value.slice("global:".length) : null
              )
            );
          }}
        >
          <option value="inline">Inline formula</option>
          {currentFormulaId && !formulas.some((formula) => formula.id === currentFormulaId) ? (
            <option value={`global:${currentFormulaId}`} disabled>
              Missing global formula: {currentFormulaId}
            </option>
          ) : null}
          {formulas.map((formula) => (
            <option key={formula.id} value={`global:${formula.id}`}>
              Global: {formula.id}
            </option>
          ))}
          {allowCalculated &&
          currentVariable &&
          !options.some((option) => option.variableId === currentVariable) ? (
            <option value={`calculated:${currentVariable}`} disabled>
              Unavailable: {currentVariable}
            </option>
          ) : null}
          {allowCalculated
            ? options.map((option) => (
                <option key={option.stepId} value={`calculated:${option.variableId}`}>
                  Calculated: {option.variableId}
                </option>
              ))
            : null}
        </select>
      </Field>
    );
  };

  return (
    <div className="template-editor action-editor">
      <h3 className="template-editor__title">
        {editingActionId ? "Edit Action" : "Create Action"}
      </h3>
      <div className="stack">
        <div className="action-editor__identity">
          <Field label="Name">
            <input
              value={values.name}
              aria-invalid={!values.name.trim()}
              onChange={(event) => onChange({ ...values, name: event.target.value })}
              placeholder="e.g. Mana burst"
            />
          </Field>

          <Field label="Roll Mode">
            <select
              value={values.rollModeKind}
              onChange={(event) =>
                onChange({
                  ...values,
                  rollModeKind: event.target.value as ActionEditorValues["rollModeKind"]
                })
              }
            >
              <option value="none">None (normal only)</option>
              <option value="check">Check (normal / advantage / disadvantage)</option>
              <option value="damage">Damage (normal / critical)</option>
            </select>
          </Field>
        </div>

        <Field label="Notes">
          <textarea
            rows={2}
            value={values.notes}
            onChange={(event) => onChange({ ...values, notes: event.target.value })}
            placeholder="GM-facing action notes"
          />
        </Field>

        <section className="action-step-builder stack">
          <div className="action-step-builder__header">
            <div>
              <h4>Steps</h4>
              <span className="muted">{values.steps.length}</span>
            </div>
            <div className="action-step-add">
              <Field label="Step Type">
                <select
                  value={stepTypeToAdd}
                  onChange={(event) => setStepTypeToAdd(event.target.value as ActionStepMenuType)}
                >
                  {ACTION_STEP_GROUPS.map((group) => (
                    <optgroup key={group} label={group}>
                      {stepMenuOptions
                        .filter((option) => option.group === group)
                        .map((option) => (
                          <option
                            key={option.type}
                            value={option.type}
                            disabled={Boolean(option.unavailableReason)}
                          >
                            {option.label}
                            {option.unavailableReason ? ` - ${option.unavailableReason}` : ""}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
              <button
                className="button"
                type="button"
                onClick={addSelectedStep}
                disabled={Boolean(selectedMenuOption?.unavailableReason)}
              >
                Add Step
              </button>
            </div>
          </div>
          <div className="action-step-list">
            {values.steps.length === 0 ? <p className="muted">No steps configured.</p> : null}
            {values.steps.map((step, stepIndex) => (
              <div
                className={`action-step-entry ${
                  selectedStepId === step.step_id ? "action-step-entry--selected" : ""
                }`}
                key={step.step_id}
              >
                <div className="action-step-entry__header">
                  <button
                    className="action-step-entry__select"
                    type="button"
                    aria-expanded={selectedStepId === step.step_id}
                    onClick={() => setSelectedStepId(step.step_id)}
                  >
                    <span className="action-step-entry__order">{stepIndex + 1}</span>
                    <span>
                      <strong>{actionStepLabel(step.type)}</strong>
                      <span className="muted">{step.step_id}</span>
                    </span>
                  </button>
                  <div className="action-step-entry__commands">
                    <button
                      className="button button--secondary"
                      type="button"
                      aria-label={`Move ${actionStepLabel(step.type)} up`}
                      disabled={stepIndex === 0}
                      onClick={() => onChange(moveActionStep(values, step.step_id, "up"))}
                    >
                      Up
                    </button>
                    <button
                      className="button button--secondary"
                      type="button"
                      aria-label={`Move ${actionStepLabel(step.type)} down`}
                      disabled={stepIndex === values.steps.length - 1}
                      onClick={() => onChange(moveActionStep(values, step.step_id, "down"))}
                    >
                      Down
                    </button>
                    <button
                      className="button button--secondary"
                      type="button"
                      onClick={() => {
                        const duplicateStepId = makeId(actionStepIdPrefix(step.type));
                        onChange(duplicateActionStep(values, step.step_id, duplicateStepId));
                        setSelectedStepId(duplicateStepId);
                      }}
                    >
                      Duplicate
                    </button>
                    <button
                      className="button button--secondary"
                      type="button"
                      onClick={() => onChange(removeActionStep(values, step.step_id))}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                {selectedStepId === step.step_id ? (
                  <div className="action-step-entry__editor">
                    {step.type === "calculate_value" ? (
                      <div className="list-item list-item--block" key={step.step_id}>
                        <div className="inline-group">
                          <Field label={`Calculated Variable: ${step.step_id}`}>
                            <input
                              value={step.variable_id}
                              pattern="[A-Za-z_][A-Za-z0-9_]*"
                              title="Start with a letter or underscore; use only letters, numbers, and underscores."
                              onChange={(event) =>
                                onChange(
                                  updateCalculateValueActionStep(values, step.step_id, {
                                    variableId: event.target.value
                                  })
                                )
                              }
                              placeholder="healing_amount"
                            />
                          </Field>
                          {formulaSourcePicker(step.step_id, step.value)}
                        </div>
                        {isInlineFormula(step.value) ? (
                          <>
                            <FormulaVariableInput
                              label="Formula"
                              value={step.value.text}
                              multiline={false}
                              options={formulaMentionOptions(step.step_id)}
                              loading={!metadata}
                              onChange={(formulaText) =>
                                onChange(
                                  updateCalculateValueActionStep(values, step.step_id, {
                                    formulaText
                                  })
                                )
                              }
                              onVariableSelect={(entry, formulaText) => {
                                if (!isInlineFormula(step.value)) {
                                  return;
                                }
                                onChange(
                                  updateCalculateValueActionStep(values, step.step_id, {
                                    formulaText,
                                    aliases: upsertFormulaAlias(
                                      step.value.aliases ?? null,
                                      entry.alias
                                    )
                                  })
                                );
                              }}
                              placeholder="Type @ to insert a variable"
                            />
                            <FormulaTagEditor
                              label="Calculation Formula Tags"
                              tags={step.value.tags ?? []}
                              onChange={(tags) =>
                                onChange(
                                  updateCalculateValueActionStep(values, step.step_id, { tags })
                                )
                              }
                            />
                          </>
                        ) : (
                          sharedFormulaHint(step.value.formula_id)
                        )}
                      </div>
                    ) : step.type === "send_roll" ? (
                      <div className="list-item list-item--block" key={step.step_id}>
                        <Field label="Roll Title">
                          <input
                            value={step.title}
                            onChange={(event) =>
                              onChange(
                                updateSendRollActionStep(values, step.step_id, {
                                  title: event.target.value
                                })
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
                                  rolls:
                                    presentation === "simple" ? step.rolls.slice(0, 1) : step.rolls
                                })
                              );
                            }}
                          >
                            <option value="simple">Check / simple</option>
                            <option value="damage">Damage</option>
                            <option value="default">Portable default</option>
                          </select>
                        </Field>
                        {step.rolls.map((roll, rollIndex) => (
                          <div className="list-item list-item--block" key={`${step.step_id}-${rollIndex}`}>
                            <Field label={`Result ${rollIndex + 1} Label`}>
                              <input
                                value={roll.label}
                                onChange={(event) => {
                                  const rolls = structuredClone(step.rolls);
                                  rolls[rollIndex] = { ...rolls[rollIndex], label: event.target.value };
                                  onChange(updateSendRollActionStep(values, step.step_id, { rolls }));
                                }}
                              />
                            </Field>
                            <Field label={`Result ${rollIndex + 1} Source`}>
                              <select
                                value={
                                  isFormulaReference(roll.value)
                                    ? `global:${roll.value.formula_id}`
                                    : "inline"
                                }
                                onChange={(event) => {
                                  const rolls = structuredClone(step.rolls);
                                  const formulaId = event.target.value.startsWith("global:")
                                    ? event.target.value.slice("global:".length)
                                    : null;
                                  rolls[rollIndex] = {
                                    ...rolls[rollIndex],
                                    value: formulaId
                                      ? { type: "formula_reference", formula_id: formulaId }
                                      : { aliases: null, text: "" }
                                  };
                                  onChange(
                                    updateSendRollActionStep(values, step.step_id, { rolls })
                                  );
                                }}
                              >
                                <option value="inline">Inline formula</option>
                                {isFormulaReference(roll.value) &&
                                !formulas
                                  .map((formula) => formula.id)
                                  .includes(roll.value.formula_id) ? (
                                  <option value={`global:${roll.value.formula_id}`} disabled>
                                    Missing global formula: {roll.value.formula_id}
                                  </option>
                                ) : null}
                                {formulas.map((formula) => (
                                  <option key={formula.id} value={`global:${formula.id}`}>
                                    Global: {formula.id}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            {isInlineFormula(roll.value) ? (
                              <>
                                <FormulaVariableInput
                                  label={`Result ${rollIndex + 1} Formula`}
                                  rows={2}
                                  value={roll.value.text}
                                  options={formulaMentionOptions(step.step_id)}
                                  loading={!metadata}
                                  onChange={(text) => {
                                    const rolls = structuredClone(step.rolls);
                                    rolls[rollIndex] = {
                                      ...rolls[rollIndex],
                                      value: { ...roll.value, text }
                                    };
                                    onChange(
                                      updateSendRollActionStep(values, step.step_id, { rolls })
                                    );
                                  }}
                                  onVariableSelect={(entry, text) => {
                                    if (!isInlineFormula(roll.value)) {
                                      return;
                                    }
                                    const rolls = structuredClone(step.rolls);
                                    rolls[rollIndex] = {
                                      ...rolls[rollIndex],
                                      value: {
                                        ...roll.value,
                                        text,
                                        aliases: upsertFormulaAlias(
                                          roll.value.aliases ?? null,
                                          entry.alias
                                        )
                                      }
                                    };
                                    onChange(
                                      updateSendRollActionStep(values, step.step_id, { rolls })
                                    );
                                  }}
                                  placeholder="Type @ to insert a variable"
                                />
                                <FormulaTagEditor
                                  label={`Result ${rollIndex + 1} Formula Tags`}
                                  tags={roll.value.tags ?? []}
                                  onChange={(tags) => {
                                    const rolls = structuredClone(step.rolls);
                                    rolls[rollIndex] = {
                                      ...roll,
                                      value: { ...roll.value, tags }
                                    };
                                    onChange(
                                      updateSendRollActionStep(values, step.step_id, { rolls })
                                    );
                                  }}
                                />
                              </>
                            ) : (
                              sharedFormulaHint(roll.value.formula_id)
                            )}
                            {rollIndex > 0 ? (
                              <button
                                className="button button--secondary"
                                type="button"
                                onClick={() =>
                                  onChange(
                                    updateSendRollActionStep(values, step.step_id, {
                                      rolls: step.rolls.filter((_, index) => index !== rollIndex)
                                    })
                                  )
                                }
                              >
                                Remove second result
                              </button>
                            ) : null}
                          </div>
                        ))}
                        {step.presentation !== "simple" && step.rolls.length < 2 ? (
                          <button
                            className="button button--secondary"
                            type="button"
                            onClick={() =>
                              onChange(
                                updateSendRollActionStep(values, step.step_id, {
                                  rolls: [
                                    ...step.rolls,
                                    { label: "Secondary", value: { aliases: null, text: "0" } }
                                  ]
                                })
                              )
                            }
                          >
                            Add second result
                          </button>
                        ) : null}
                      </div>
                    ) : step.type === "send_message" ? (
                      <div className="list-item list-item--block" key={step.step_id}>
                        {formulaSourcePicker(step.step_id, step.message, {
                          label: `Message Source: ${step.step_id}`
                        })}
                        {isInlineFormula(step.message) ? (
                          <>
                            <FormulaVariableInput
                              label="Message Formula"
                              rows={3}
                              value={step.message.text}
                              options={formulaMentionOptions(step.step_id)}
                              loading={!metadata}
                              onChange={(messageText) =>
                                onChange(
                                  updateSendMessageActionStepText(
                                    values,
                                    step.step_id,
                                    messageText
                                  )
                                )
                              }
                              onVariableSelect={(entry, messageText) => {
                                if (!isInlineFormula(step.message)) {
                                  return;
                                }
                                onChange(
                                  updateSendMessageActionStepFormula(values, step.step_id, {
                                    messageText,
                                    aliases: upsertFormulaAlias(
                                      step.message.aliases ?? null,
                                      entry.alias
                                    )
                                  })
                                );
                              }}
                              placeholder="Type @ to insert a variable"
                            />
                            <FormulaTagEditor
                              label="Message Formula Tags"
                              tags={step.message.tags ?? []}
                              onChange={(tags) =>
                                onChange(
                                  updateSendMessageActionStepFormula(values, step.step_id, { tags })
                                )
                              }
                            />
                          </>
                        ) : (
                          sharedFormulaHint(step.message.formula_id)
                        )}
                      </div>
                    ) : step.type === "set_value" ||
                      step.type === "increment_value" ||
                      step.type === "decrement_value" ? (
                      <ActionBoundedMutationStepEditor
                        key={step.step_id}
                        step={step}
                        values={values}
                        onChange={onChange}
                        metadata={metadata}
                        mutationTargets={mutationTargets}
                        formulas={formulas}
                      />
                    ) : step.type === "resolve_damage" ? (
                      <div className="list-item list-item--block" key={step.step_id}>
                        <div className="inline-group">
                          <Field label={`Damage Type: ${step.step_id}`}>
                            <select
                              value={step.damage_type}
                              onChange={(event) =>
                                onChange(
                                  updateResolveDamageActionStep(values, step.step_id, {
                                    damageType: event.target.value as DamageType
                                  })
                                )
                              }
                            >
                              {DAMAGE_TYPES.map((damageType) => (
                                <option key={damageType} value={damageType}>
                                  {damageType}
                                </option>
                              ))}
                            </select>
                          </Field>
                          {formulaSourcePicker(step.step_id, step.amount, {
                            allowCalculated: true,
                            label: "Amount Source"
                          })}
                        </div>
                        {isInlineFormula(step.amount) ? (
                          <>
                            <FormulaVariableInput
                              label="Amount Formula"
                              value={step.amount.text}
                              multiline={false}
                              options={formulaMentionOptions(step.step_id)}
                              loading={!metadata}
                              onChange={(amountText) =>
                                onChange(
                                  updateResolveDamageActionStep(values, step.step_id, { amountText })
                                )
                              }
                              onVariableSelect={(entry, amountText) => {
                                if (!isInlineFormula(step.amount)) {
                                  return;
                                }
                                onChange(
                                  updateResolveDamageActionStepFormula(values, step.step_id, {
                                    amountText,
                                    aliases: upsertFormulaAlias(
                                      step.amount.aliases ?? null,
                                      entry.alias
                                    )
                                  })
                                );
                              }}
                              placeholder="Type @ to insert a variable"
                            />
                            <FormulaTagEditor
                              label="Damage Formula Tags"
                              tags={step.amount.tags ?? []}
                              onChange={(tags) =>
                                onChange(
                                  updateResolveDamageActionStepFormula(values, step.step_id, {
                                    tags
                                  })
                                )
                              }
                            />
                          </>
                        ) : isFormulaReference(step.amount) ? (
                          sharedFormulaHint(step.amount.formula_id)
                        ) : (
                          <p className="muted">
                            Reuses {step.amount.variable_id} directly without reevaluating its
                            formula.
                          </p>
                        )}
                      </div>
                    ) : step.type === "gain_proficiency_use" ? (
                      <div className="list-item list-item--block" key={step.step_id}>
                        <div className="inline-group">
                          {(step.proficiency_reference ?? "explicit") === "explicit" ? (
                            <Field label={`Proficiency: ${step.step_id}`}>
                              <select
                                value={step.proficiency_id}
                                onChange={(event) =>
                                  onChange(
                                    updateGainProficiencyUseActionStep(values, step.step_id, {
                                      proficiencyId: event.target.value
                                    })
                                  )
                                }
                              >
                                {proficiencies.some(
                                  (proficiency) => proficiency.id === step.proficiency_id
                                ) ? null : (
                                  <option value={step.proficiency_id}>{step.proficiency_id}</option>
                                )}
                                {proficiencies.map((proficiency) => (
                                  <option key={proficiency.id} value={proficiency.id}>
                                    {proficiency.name}
                                  </option>
                                ))}
                              </select>
                            </Field>
                          ) : (
                            <p className="muted">
                              {(step.proficiency_reference ?? "explicit") === "action_attribute"
                                ? "Trains the proficiency selected by this action."
                                : "Trains the selected weapon's proficiency."}
                            </p>
                          )}
                          {formulaSourcePicker(step.step_id, step.amount, {
                            allowCalculated: true,
                            label: "Amount Source"
                          })}
                        </div>
                        {isInlineFormula(step.amount) ? (
                          <>
                            <FormulaVariableInput
                              label="Use Amount Formula"
                              value={step.amount.text}
                              multiline={false}
                              options={formulaMentionOptions(step.step_id)}
                              loading={!metadata}
                              onChange={(amountText) =>
                                onChange(
                                  updateGainProficiencyUseActionStep(values, step.step_id, {
                                    amountText
                                  })
                                )
                              }
                              onVariableSelect={(entry, amountText) => {
                                if (!isInlineFormula(step.amount)) {
                                  return;
                                }
                                onChange(
                                  updateGainProficiencyUseActionStepFormula(values, step.step_id, {
                                    amountText,
                                    aliases: upsertFormulaAlias(
                                      step.amount.aliases ?? null,
                                      entry.alias
                                    )
                                  })
                                );
                              }}
                              placeholder="Type @ to insert a variable"
                            />
                            <FormulaTagEditor
                              label="Proficiency Formula Tags"
                              tags={step.amount.tags ?? []}
                              onChange={(tags) =>
                                onChange(
                                  updateGainProficiencyUseActionStepFormula(values, step.step_id, {
                                    tags
                                  })
                                )
                              }
                            />
                          </>
                        ) : isFormulaReference(step.amount) ? (
                          sharedFormulaHint(step.amount.formula_id)
                        ) : (
                          <p className="muted">
                            Reuses {step.amount.variable_id} directly without reevaluating its
                            formula.
                          </p>
                        )}
                      </div>
                    ) : step.type === "apply_augmentation" ||
                      step.type === "apply_condition_preset" ? (
                      <ActionRecordStepEditor
                        key={step.step_id}
                        step={step}
                        values={values}
                        onChange={onChange}
                        standaloneEffects={standaloneEffects}
                        conditions={conditions}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <details className="authoring-disclosure">
          <summary>
            <span>
              <strong>Attributes</strong>
              <small>Optional values such as range or resource cost</small>
            </span>
          </summary>
          <div className="authoring-disclosure__body">{attributesEditor}</div>
        </details>

        {showValidationError && validationError ? (
          <p className="error-text" role="alert">
            {validationError}
          </p>
        ) : null}
        <div className="template-editor__actions action-editor__footer">
          <button className="button" onClick={onSubmit} disabled={!actionIsValid || pending}>
            {pending ? (editingActionId ? "Saving…" : "Creating…") : editingActionId ? "Save Action" : "Create Action"}
          </button>
          {editingActionId ? (
            <button className="button button--secondary" onClick={onCancel}>
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
