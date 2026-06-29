import { Field } from "@/shared/ui/Field";
import {
  DAMAGE_TYPES,
  type Augmentation,
  type ConditionPreset,
  type DamageType,
  type FormulaDefinition,
  type ProficiencyDefinition
} from "@/domain/models";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import {
  addCalculateValueActionStep,
  addApplyAugmentationActionStep,
  addApplyConditionPresetActionStep,
  addDecrementValueActionStep,
  addGainProficiencyUseActionStep,
  addIncrementValueActionStep,
  addResolveDamageActionStep,
  addSendMessageActionStep,
  addSetValueActionStep,
  calculatedValuesBeforeStep,
  isCalculatedValueReference,
  isFormulaReference,
  isInlineFormula,
  moveActionStep,
  moveGainProficiencyUseActionStep,
  moveResolveDamageActionStep,
  moveSendMessageActionStep,
  removeCalculateValueActionStep,
  removeGainProficiencyUseActionStep,
  removeResolveDamageActionStep,
  removeSendMessageActionStep,
  setNumericStepCalculatedValue,
  setActionStepFormulaReference,
  updateCalculateValueActionStep,
  updateGainProficiencyUseActionStep,
  updateGainProficiencyUseActionStepFormula,
  updateResolveDamageActionStep,
  updateResolveDamageActionStepFormula,
  updateSendMessageActionStepText,
  updateSendMessageActionStepFormula,
  type ActionEditorValues,
  type ResolveDamageEditorStep
} from "@/features/actions/actionEditorValues";
import { ActionBoundedMutationStepEditor } from "@/features/actions/components/ActionBoundedMutationStepEditor";
import { ActionRecordStepEditor } from "@/features/actions/components/ActionRecordStepEditor";
import { VariablePathBrowser } from "@/features/variables/components/VariablePathBrowser";
import {
  appendFormulaToken,
  buildVariablePickerEntries,
  upsertFormulaAlias,
  type VariablePickerEntry
} from "@/features/variables/variablePicker";
import { makeId } from "@/shared/utils/id";
import { FormulaTagEditor } from "@/features/formulas/components/FormulaTagEditor";

export function ActionEditorForm({
  editingActionId,
  values,
  onChange,
  onSubmit,
  onCancel,
  metadata,
  proficiencies,
  formulas,
  augmentations,
  conditions
}: {
  editingActionId: string | null;
  values: ActionEditorValues;
  onChange: (values: ActionEditorValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
  metadata: ActionFormulaAuthoringMetadata | null;
  proficiencies: ProficiencyDefinition[];
  formulas: FormulaDefinition[];
  augmentations: Augmentation[];
  conditions: ConditionPreset[];
}): JSX.Element {
  const defaultProficiencyId = proficiencies[0]?.id ?? "";
  const mutationTargets = buildVariablePickerEntries(metadata, "mutation").filter(
    (entry) => entry.root === "instance"
  );

  const insertCalculatedValue = (stepId: string, variableId: string): void => {
    const step = values.steps.find((candidate) => candidate.step_id === stepId);
    if (!step) {
      return;
    }
    const alias = {
      name: variableId,
      path: ["action_values", variableId]
    };
    const token = `@${variableId}`;
    if (step.type === "send_message" && isInlineFormula(step.message)) {
      onChange(
        updateSendMessageActionStepFormula(values, stepId, {
          messageText: appendFormulaToken(step.message.text, token),
          aliases: upsertFormulaAlias(step.message.aliases ?? null, alias)
        })
      );
      return;
    }
    if (step.type === "calculate_value" && isInlineFormula(step.value)) {
      onChange(
        updateCalculateValueActionStep(values, stepId, {
          formulaText: appendFormulaToken(step.value.text, token),
          aliases: upsertFormulaAlias(step.value.aliases ?? null, alias)
        })
      );
      return;
    }
    if (step.type === "resolve_damage" && isInlineFormula(step.amount)) {
      onChange(
        updateResolveDamageActionStepFormula(values, stepId, {
          amountText: appendFormulaToken(step.amount.text, token),
          aliases: upsertFormulaAlias(step.amount.aliases ?? null, alias)
        })
      );
      return;
    }
    if (step.type === "gain_proficiency_use" && isInlineFormula(step.amount)) {
      onChange(
        updateGainProficiencyUseActionStepFormula(values, stepId, {
          amountText: appendFormulaToken(step.amount.text, token),
          aliases: upsertFormulaAlias(step.amount.aliases ?? null, alias)
        })
      );
    }
  };

  const calculatedValuePicker = (stepId: string, label: string): JSX.Element | null => {
    const options = calculatedValuesBeforeStep(values, stepId);
    if (options.length === 0) {
      return null;
    }
    return (
      <Field label={label}>
        <select
          value=""
          onChange={(event) => {
            if (event.target.value) {
              insertCalculatedValue(stepId, event.target.value);
            }
          }}
        >
          <option value="">Insert a previous calculated value</option>
          {options.map((option) => (
            <option key={option.stepId} value={option.variableId}>
              {option.variableId} ({option.stepId})
            </option>
          ))}
        </select>
      </Field>
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

  const insertIntoMessageStep = (stepId: string, entry: VariablePickerEntry): void => {
    const step = values.steps.find(
      (candidate) => candidate.step_id === stepId && candidate.type === "send_message"
    );
    if (!step || step.type !== "send_message" || !isInlineFormula(step.message)) {
      return;
    }

    onChange(
      updateSendMessageActionStepFormula(values, stepId, {
        messageText: appendFormulaToken(step.message.text, entry.token),
        aliases: upsertFormulaAlias(step.message.aliases ?? null, entry.alias)
      })
    );
  };

  const insertIntoDamageStep = (stepId: string, entry: VariablePickerEntry): void => {
    const step = values.steps.find(
      (candidate) => candidate.step_id === stepId && candidate.type === "resolve_damage"
    );
    if (!step || step.type !== "resolve_damage" || !isInlineFormula(step.amount)) {
      return;
    }

    onChange(
      updateResolveDamageActionStepFormula(values, stepId, {
        amountText: appendFormulaToken(step.amount.text, entry.token),
        aliases: upsertFormulaAlias(step.amount.aliases ?? null, entry.alias)
      })
    );
  };

  const insertIntoProficiencyStep = (stepId: string, entry: VariablePickerEntry): void => {
    const step = values.steps.find(
      (candidate) => candidate.step_id === stepId && candidate.type === "gain_proficiency_use"
    );
    if (!step || step.type !== "gain_proficiency_use" || !isInlineFormula(step.amount)) {
      return;
    }

    onChange(
      updateGainProficiencyUseActionStepFormula(values, stepId, {
        amountText: appendFormulaToken(step.amount.text, entry.token),
        aliases: upsertFormulaAlias(step.amount.aliases ?? null, entry.alias)
      })
    );
  };

  return (
    <div className="template-editor action-editor">
      <p className="template-editor__title">{editingActionId ? "Edit Action" : "Create Action"}</p>
      <div className="stack">
        <Field label="Name">
          <input
            value={values.name}
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

        <Field label="Notes">
          <textarea
            rows={3}
            value={values.notes}
            onChange={(event) => onChange({ ...values, notes: event.target.value })}
            placeholder="GM-facing action notes"
          />
        </Field>

        <div className="stack">
          <div className="list-item__top">
            <span className="muted">Steps: {values.steps.length}</span>
            <div className="inline-actions">
              <button
                className="button button--secondary"
                onClick={() => {
                  const stepId = makeId("calculate");
                  const existingVariables = new Set(
                    values.steps
                      .filter((step) => step.type === "calculate_value")
                      .map((step) => step.variable_id)
                  );
                  let variableIndex = existingVariables.size + 1;
                  while (existingVariables.has(`value_${variableIndex}`)) {
                    variableIndex += 1;
                  }
                  const variableId = `value_${variableIndex}`;
                  onChange(addCalculateValueActionStep(values, stepId, variableId));
                }}
              >
                Add Calculation
              </button>
              <button
                className="button button--secondary"
                onClick={() => onChange(addSendMessageActionStep(values, makeId("step")))}
              >
                Add Message
              </button>
              <button
                className="button button--secondary"
                onClick={() => onChange(addResolveDamageActionStep(values, makeId("damage")))}
              >
                Add Damage
              </button>
              <button
                className="button button--secondary"
                disabled={mutationTargets.length === 0}
                onClick={() => {
                  const target = mutationTargets[0];
                  if (target) {
                    onChange(addSetValueActionStep(values, makeId("set"), target.path));
                  }
                }}
              >
                Add Set
              </button>
              <button
                className="button button--secondary"
                disabled={mutationTargets.length === 0}
                onClick={() => {
                  const target = mutationTargets[0];
                  if (target) {
                    onChange(addIncrementValueActionStep(values, makeId("increase"), target.path));
                  }
                }}
              >
                Add Increase
              </button>
              <button
                className="button button--secondary"
                disabled={mutationTargets.length === 0}
                onClick={() => {
                  const target = mutationTargets[0];
                  if (target) {
                    onChange(addDecrementValueActionStep(values, makeId("decrease"), target.path));
                  }
                }}
              >
                Add Decrease
              </button>
              <button
                className="button button--secondary"
                disabled={!defaultProficiencyId}
                onClick={() =>
                  onChange(
                    addGainProficiencyUseActionStep(
                      values,
                      makeId("proficiency"),
                      defaultProficiencyId
                    )
                  )
                }
              >
                Add Proficiency
              </button>
              <button
                className="button button--secondary"
                disabled={augmentations.length === 0}
                onClick={() => {
                  const augmentation = augmentations[0];
                  if (augmentation) {
                    onChange(
                      addApplyAugmentationActionStep(
                        values,
                        makeId("augmentation"),
                        augmentation.id
                      )
                    );
                  }
                }}
              >
                Add Augmentation
              </button>
              <button
                className="button button--secondary"
                disabled={conditions.length === 0}
                onClick={() => {
                  const condition = conditions[0];
                  if (condition) {
                    onChange(
                      addApplyConditionPresetActionStep(values, makeId("condition"), condition.id)
                    );
                  }
                }}
              >
                Add Condition
              </button>
            </div>
          </div>
          <div className="list">
            {values.steps.map((step) =>
              step.type === "calculate_value" ? (
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
                      <Field label="Formula">
                        <input
                          value={step.value.text}
                          onChange={(event) =>
                            onChange(
                              updateCalculateValueActionStep(values, step.step_id, {
                                formulaText: event.target.value
                              })
                            )
                          }
                          placeholder="e.g. 1d8 + 2"
                        />
                      </Field>
                      <VariablePathBrowser
                        metadata={metadata}
                        mode="formula"
                        title="Calculation Variables"
                        onPick={(entry) => {
                          if (!isInlineFormula(step.value)) {
                            return;
                          }
                          onChange(
                            updateCalculateValueActionStep(values, step.step_id, {
                              formulaText: appendFormulaToken(step.value.text, entry.token),
                              aliases: upsertFormulaAlias(step.value.aliases ?? null, entry.alias)
                            })
                          );
                        }}
                      />
                      {calculatedValuePicker(step.step_id, "Earlier Calculated Value")}
                      <FormulaTagEditor
                        label="Calculation Formula Tags"
                        tags={step.value.tags ?? []}
                        onChange={(tags) =>
                          onChange(updateCalculateValueActionStep(values, step.step_id, { tags }))
                        }
                      />
                    </>
                  ) : (
                    <p className="muted">Uses global formula {step.value.formula_id} by ID.</p>
                  )}
                  <div className="inline-actions">
                    <button
                      className="button button--secondary"
                      onClick={() => onChange(moveActionStep(values, step.step_id, "up"))}
                    >
                      Up
                    </button>
                    <button
                      className="button button--secondary"
                      onClick={() => onChange(moveActionStep(values, step.step_id, "down"))}
                    >
                      Down
                    </button>
                    <button
                      className="button button--secondary"
                      onClick={() => onChange(removeCalculateValueActionStep(values, step.step_id))}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : step.type === "send_message" ? (
                <div className="list-item list-item--block" key={step.step_id}>
                  {formulaSourcePicker(step.step_id, step.message, {
                    label: `Message Source: ${step.step_id}`
                  })}
                  {isInlineFormula(step.message) ? (
                    <>
                      <Field label="Message Formula">
                        <textarea
                          rows={3}
                          value={step.message.text}
                          onChange={(event) =>
                            onChange(
                              updateSendMessageActionStepText(
                                values,
                                step.step_id,
                                event.target.value
                              )
                            )
                          }
                          placeholder="/em describes the action."
                        />
                      </Field>
                      <VariablePathBrowser
                        metadata={metadata}
                        mode="formula"
                        title="Message Variables"
                        onPick={(entry) => insertIntoMessageStep(step.step_id, entry)}
                      />
                      {calculatedValuePicker(step.step_id, "Earlier Calculated Value")}
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
                    <p className="muted">Uses global formula {step.message.formula_id} by ID.</p>
                  )}
                  <div className="inline-actions">
                    <button
                      className="button button--secondary"
                      onClick={() =>
                        onChange(moveSendMessageActionStep(values, step.step_id, "up"))
                      }
                    >
                      Up
                    </button>
                    <button
                      className="button button--secondary"
                      onClick={() =>
                        onChange(moveSendMessageActionStep(values, step.step_id, "down"))
                      }
                    >
                      Down
                    </button>
                    <button
                      className="button button--secondary"
                      onClick={() => onChange(removeSendMessageActionStep(values, step.step_id))}
                    >
                      Delete
                    </button>
                  </div>
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
                      <Field label="Amount Formula">
                        <input
                          value={step.amount.text}
                          onChange={(event) =>
                            onChange(
                              updateResolveDamageActionStep(values, step.step_id, {
                                amountText: event.target.value
                              })
                            )
                          }
                          placeholder="e.g. @strength * 2"
                        />
                      </Field>
                      <VariablePathBrowser
                        metadata={metadata}
                        mode="formula"
                        title="Damage Amount Variables"
                        onPick={(entry) => insertIntoDamageStep(step.step_id, entry)}
                      />
                      {calculatedValuePicker(step.step_id, "Earlier Calculated Value in Formula")}
                      <FormulaTagEditor
                        label="Damage Formula Tags"
                        tags={step.amount.tags ?? []}
                        onChange={(tags) =>
                          onChange(
                            updateResolveDamageActionStepFormula(values, step.step_id, { tags })
                          )
                        }
                      />
                    </>
                  ) : isFormulaReference(step.amount) ? (
                    <p className="muted">Uses global formula {step.amount.formula_id} by ID.</p>
                  ) : (
                    <p className="muted">
                      Reuses {step.amount.variable_id} directly without reevaluating its formula.
                    </p>
                  )}
                  <div className="inline-actions">
                    <button
                      className="button button--secondary"
                      onClick={() =>
                        onChange(moveResolveDamageActionStep(values, step.step_id, "up"))
                      }
                    >
                      Up
                    </button>
                    <button
                      className="button button--secondary"
                      onClick={() =>
                        onChange(moveResolveDamageActionStep(values, step.step_id, "down"))
                      }
                    >
                      Down
                    </button>
                    <button
                      className="button button--secondary"
                      onClick={() => onChange(removeResolveDamageActionStep(values, step.step_id))}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : step.type === "gain_proficiency_use" ? (
                <div className="list-item list-item--block" key={step.step_id}>
                  <div className="inline-group">
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
                    {formulaSourcePicker(step.step_id, step.amount, {
                      allowCalculated: true,
                      label: "Amount Source"
                    })}
                  </div>
                  {isInlineFormula(step.amount) ? (
                    <>
                      <Field label="Use Amount Formula">
                        <input
                          value={step.amount.text}
                          onChange={(event) =>
                            onChange(
                              updateGainProficiencyUseActionStep(values, step.step_id, {
                                amountText: event.target.value
                              })
                            )
                          }
                          placeholder="e.g. 1"
                        />
                      </Field>
                      <VariablePathBrowser
                        metadata={metadata}
                        mode="formula"
                        title="Use Amount Variables"
                        onPick={(entry) => insertIntoProficiencyStep(step.step_id, entry)}
                      />
                      {calculatedValuePicker(step.step_id, "Earlier Calculated Value in Formula")}
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
                    <p className="muted">Uses global formula {step.amount.formula_id} by ID.</p>
                  ) : (
                    <p className="muted">
                      Reuses {step.amount.variable_id} directly without reevaluating its formula.
                    </p>
                  )}
                  <div className="inline-actions">
                    <button
                      className="button button--secondary"
                      onClick={() =>
                        onChange(moveGainProficiencyUseActionStep(values, step.step_id, "up"))
                      }
                    >
                      Up
                    </button>
                    <button
                      className="button button--secondary"
                      onClick={() =>
                        onChange(moveGainProficiencyUseActionStep(values, step.step_id, "down"))
                      }
                    >
                      Down
                    </button>
                    <button
                      className="button button--secondary"
                      onClick={() =>
                        onChange(removeGainProficiencyUseActionStep(values, step.step_id))
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : step.type === "apply_augmentation" || step.type === "apply_condition_preset" ? (
                <ActionRecordStepEditor
                  key={step.step_id}
                  step={step}
                  values={values}
                  onChange={onChange}
                  augmentations={augmentations}
                  conditions={conditions}
                />
              ) : null
            )}
          </div>
        </div>

        <div className="template-editor__actions">
          <button className="button" onClick={onSubmit}>
            {editingActionId ? "Save Action" : "Create Action"}
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
