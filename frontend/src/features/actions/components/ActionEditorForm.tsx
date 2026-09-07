import { useEffect, useState } from "react";
import { ActionPointsStepEditor } from "./ActionPointsStepEditor";
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
  customizeActionStepFormula,
  duplicateActionStep,
  ensureActionProficienciesForFormula,
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
import { ActionSendRollStepEditor } from "@/features/actions/components/ActionSendRollStepEditor";
import { ActionSharedFormulaSource } from "@/features/actions/components/ActionSharedFormulaSource";
import { FormulaVariableInput } from "@/features/variables/components/FormulaVariableInput";
import {
  buildVariablePickerEntries,
  formulaVariableSearchOptions,
  upsertFormulaAlias
} from "@/features/variables/variablePicker";
import { makeId } from "@/shared/utils/id";
import { FormulaTagEditor } from "@/features/formulas/components/FormulaTagEditor";
import { CatalogEntityPicker } from "@/features/catalogs/CatalogEntityPicker";
import { FormValidationSummary } from "@/shared/ui/FormValidationSummary";

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
  validationAttempted = false,
  pending = false,
  onFocusedStepChange
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
  validationAttempted?: boolean;
  pending?: boolean;
  onFocusedStepChange?: (stepId: string | null) => void;
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
  const requiredFieldMissing =
    !values.name.trim() ||
    values.steps.some(
      (step) =>
        (step.type === "send_roll" &&
          (!step.title.trim() || step.rolls.some((roll) => !roll.label.trim()))) ||
        (step.type === "gain_proficiency_use" &&
          (!step.proficiency_id ||
            !proficiencies.some((proficiency) => proficiency.id === step.proficiency_id)))
    );
  const attachedProficiencyIds = new Set(
    values.proficiencies.map((binding) => binding.proficiency_id)
  );
  const formulaSearchContexts = {};
  const actionFormulaOptions = formulaVariableSearchOptions(metadata);
  const selectedStepIndex = values.steps.findIndex((step) => step.step_id === selectedStepId);
  const selectedStep = selectedStepIndex >= 0 ? values.steps[selectedStepIndex] : null;
  const focusStep = (stepId: string | null): void => {
    setSelectedStepId(stepId);
    onFocusedStepChange?.(stepId);
  };

  useEffect(() => {
    if (!selectedStepId || values.steps.some((step) => step.step_id === selectedStepId)) {
      return;
    }
    setSelectedStepId(null);
    onFocusedStepChange?.(null);
  }, [selectedStepId, values.steps, onFocusedStepChange]);

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
    focusStep(stepId);
  };

  const formulaMentionOptions = (stepId: string) => [
    ...actionFormulaOptions,
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

  const sharedFormulaEditor = (stepId: string, formulaId: string): JSX.Element => {
    const definition = formulas.find((formula) => formula.id === formulaId);
    return (
      <ActionSharedFormulaSource
        formulaId={formulaId}
        definition={definition ?? null}
        onCustomize={() => {
          if (definition) {
            onChange(
              ensureActionProficienciesForFormula(
                customizeActionStepFormula(values, stepId, definition.formula),
                definition.formula
              )
            );
          }
        }}
      />
    );
  };

  const formulaSummary = (source: ResolveDamageEditorStep["amount"]): string => {
    if (isCalculatedValueReference(source)) {
      return `Calculated: ${source.variable_id}`;
    }
    if (isFormulaReference(source)) {
      return formulas.find((formula) => formula.id === source.formula_id)?.id ?? "Shared formula";
    }
    return source.text.trim() || "Empty new formula";
  };

  const stepSummary = (step: ActionEditorValues["steps"][number]): string => {
    switch (step.type) {
      case "calculate_value":
        return `${step.variable_id} · ${formulaSummary(step.value)}`;
      case "send_message":
        return formulaSummary(step.message);
      case "send_roll": {
        const presentation =
          step.presentation === "simple"
            ? "Check / simple"
            : step.presentation === "damage"
              ? "Damage"
              : "Portable default";
        return `${step.title.trim() || "Untitled roll"} · ${presentation} · ${step.rolls.length} ${step.rolls.length === 1 ? "result" : "results"}`;
      }
      case "set_value":
        return `${step.path.at(-1) ?? "Sheet value"} · ${formulaSummary(step.value)}`;
      case "increment_value":
      case "decrement_value":
        return `${step.path.at(-1) ?? "Sheet value"} · ${formulaSummary(step.amount)}`;
      case "adjust_action_points":
        return `${step.operation === "restore" ? "Restore" : "Consume"} ${step.amount ?? 1} action point${(step.amount ?? 1) === 1 ? "" : "s"}`;
      case "resolve_damage":
        return `${step.damage_type} · ${formulaSummary(step.amount)}`;
      case "gain_proficiency_use":
        return `${proficiencies.find((entry) => entry.id === step.proficiency_id)?.name ?? "Missing proficiency"} · ${formulaSummary(step.amount)}`;
      case "apply_augmentation":
        return `${step.operation === "remove" ? "Remove" : "Apply"} ${standaloneEffects.find((entry) => entry.id === step.augmentation_id)?.name ?? "missing effect"}`;
      case "apply_condition_preset":
        return `${step.operation === "remove" ? "Remove" : "Apply"} ${conditions.find((entry) => entry.id === step.condition_id)?.name ?? "missing condition"}`;
    }
  };

  const formulaSourcePicker = (
    stepId: string,
    source: ResolveDamageEditorStep["amount"],
    { allowCalculated = false, label = "Formula Source" } = {}
  ): JSX.Element => {
    const options = calculatedValuesBeforeStep(values, stepId);
    const currentVariable = isCalculatedValueReference(source) ? source.variable_id : null;
    const currentFormulaId = isFormulaReference(source) ? source.formula_id : null;
    const selectedSourceId = currentVariable
      ? `calculated:${currentVariable}`
      : currentFormulaId
        ? `global:${currentFormulaId}`
        : "inline";
    return (
      <CatalogEntityPicker
        catalog="formulas"
        label={label}
        placeholder="Search formula catalog"
        selectedId={selectedSourceId}
        options={[
          {
            id: "inline",
            label: "Custom formula",
            keywords: ["local"],
            value: "inline"
          },
          ...(currentFormulaId && !formulas.some((formula) => formula.id === currentFormulaId)
            ? [
                {
                  id: `global:${currentFormulaId}`,
                  label: `Missing global formula: ${currentFormulaId}`,
                  organizationEntryId: currentFormulaId,
                  disabledReason: "Missing definition",
                  value: `global:${currentFormulaId}`
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
          })),
          ...(allowCalculated &&
          currentVariable &&
          !options.some((option) => option.variableId === currentVariable)
            ? [
                {
                  id: `calculated:${currentVariable}`,
                  label: `Unavailable: ${currentVariable}`,
                  disabledReason: "Earlier value is unavailable",
                  value: `calculated:${currentVariable}`
                }
              ]
            : []),
          ...(allowCalculated
            ? options.map((option) => ({
                id: `calculated:${option.variableId}`,
                label: `Calculated: ${option.variableId}`,
                secondary: `Earlier step: ${option.stepId}`,
                keywords: [option.variableId, option.stepId, "calculated"],
                value: `calculated:${option.variableId}`
              }))
            : [])
        ]}
        emptyMessage="No formula sources available."
        onSelect={(value) => {
          if (value.startsWith("calculated:")) {
            onChange(
              setNumericStepCalculatedValue(values, stepId, value.slice("calculated:".length))
            );
            return;
          }
          const formulaId = value.startsWith("global:") ? value.slice("global:".length) : null;
          const nextValues = setActionStepFormulaReference(values, stepId, formulaId);
          const definition = formulas.find((formula) => formula.id === formulaId);
          onChange(
            definition
              ? ensureActionProficienciesForFormula(nextValues, definition.formula)
              : nextValues
          );
        }}
      />
    );
  };

  return (
    <div
      className={`template-editor action-editor${selectedStep ? " action-editor--step-focused" : ""}`}
    >
      {!selectedStep ? (
        <h3 className="template-editor__title">
          {editingActionId ? "Edit Action" : "Create Action"}
        </h3>
      ) : null}
      <div className="stack">
        {selectedStep ? (
          <div className="action-step-focus__navigation">
            <button
              className="button button--secondary"
              type="button"
              onClick={() => focusStep(null)}
            >
              Back to Action
            </button>
            <span>
              <strong>
                Step {selectedStepIndex + 1}: {actionStepLabel(selectedStep.type)}
              </strong>
              <small className="muted">Changes are kept in this Action draft.</small>
            </span>
          </div>
        ) : null}
        <div className="action-editor__identity">
          <Field label="Name" required invalid={validationAttempted && !values.name.trim()}>
            <input
              value={values.name}
              required
              aria-invalid={validationAttempted && !values.name.trim()}
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

        <div className="action-editor__notes">
          <Field label="Notes">
            <textarea
              rows={2}
              value={values.notes}
              onChange={(event) => onChange({ ...values, notes: event.target.value })}
              placeholder="GM-facing action notes"
            />
          </Field>
        </div>

        {!selectedStep ? (
          <section className="action-step-builder stack" aria-label="Action proficiencies">
            <div className="action-step-builder__header">
              <div className="action-proficiency-heading">
                <h4>Proficiencies</h4>
                <span className="muted">{values.proficiencies.length} attached</span>
              </div>
              <Field label="Add Proficiency">
                <select
                  value=""
                  onChange={(event) => {
                    const proficiencyId = event.target.value;
                    if (!proficiencyId) {
                      return;
                    }
                    onChange({
                      ...values,
                      proficiencies: [
                        ...values.proficiencies,
                        { proficiency_id: proficiencyId, gain_on_use: true }
                      ]
                    });
                  }}
                >
                  <option value="">Choose proficiency</option>
                  {proficiencies
                    .filter((entry) => !attachedProficiencyIds.has(entry.id))
                    .map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
            <p className="muted">
              Add every proficiency this action may use. Attached proficiency modifiers become
              available in formula variable pickers.
            </p>
            <div className="action-proficiency-list">
              {values.proficiencies.map((binding) => {
                const proficiency = proficiencies.find(
                  (entry) => entry.id === binding.proficiency_id
                );
                return (
                  <div className="action-proficiency-row" key={binding.proficiency_id}>
                    <span className="action-proficiency-row__identity">
                      <strong>{proficiency?.name ?? binding.proficiency_id}</strong>
                      {proficiency && proficiency.name !== binding.proficiency_id ? (
                        <small className="muted">{binding.proficiency_id}</small>
                      ) : null}
                    </span>
                    <div className="action-proficiency-row__controls">
                      <label className="action-proficiency-growth-toggle">
                        <input
                          type="checkbox"
                          checked={binding.gain_on_use}
                          onChange={(event) =>
                            onChange({
                              ...values,
                              proficiencies: values.proficiencies.map((entry) =>
                                entry.proficiency_id === binding.proficiency_id
                                  ? { ...entry, gain_on_use: event.target.checked }
                                  : entry
                              )
                            })
                          }
                        />
                        <span>Automatically gain 1 use</span>
                      </label>
                      <button
                        type="button"
                        className="button button--secondary"
                        onClick={() =>
                          onChange({
                            ...values,
                            proficiencies: values.proficiencies.filter(
                              (entry) => entry.proficiency_id !== binding.proficiency_id
                            )
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

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
                  <div className="action-step-entry__summary">
                    <span className="action-step-entry__order">{stepIndex + 1}</span>
                    <span>
                      <strong>{actionStepLabel(step.type)}</strong>
                      <span className="muted">{stepSummary(step)}</span>
                    </span>
                  </div>
                  <div className="action-step-entry__commands">
                    <button
                      className="button"
                      type="button"
                      onClick={() => focusStep(step.step_id)}
                    >
                      Edit
                    </button>
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
                        focusStep(duplicateStepId);
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
                          <Field label="Calculated Variable">
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
                                  ensureActionProficienciesForFormula(
                                    updateCalculateValueActionStep(values, step.step_id, {
                                      formulaText,
                                      aliases: upsertFormulaAlias(
                                        step.value.aliases ?? null,
                                        entry.alias
                                      )
                                    }),
                                    { aliases: [entry.alias] }
                                  )
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
                          sharedFormulaEditor(step.step_id, step.value.formula_id)
                        )}
                      </div>
                    ) : step.type === "send_roll" ? (
                      <ActionSendRollStepEditor
                        key={step.step_id}
                        step={step}
                        values={values}
                        onChange={onChange}
                        formulas={formulas}
                        formulaOptions={formulaMentionOptions(step.step_id)}
                        loading={!metadata}
                        validationAttempted={validationAttempted}
                      />
                    ) : step.type === "send_message" ? (
                      <div className="list-item list-item--block" key={step.step_id}>
                        {formulaSourcePicker(step.step_id, step.message, {
                          label: "Message Source"
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
                                  updateSendMessageActionStepText(values, step.step_id, messageText)
                                )
                              }
                              onVariableSelect={(entry, messageText) => {
                                if (!isInlineFormula(step.message)) {
                                  return;
                                }
                                onChange(
                                  ensureActionProficienciesForFormula(
                                    updateSendMessageActionStepFormula(values, step.step_id, {
                                      messageText,
                                      aliases: upsertFormulaAlias(
                                        step.message.aliases ?? null,
                                        entry.alias
                                      )
                                    }),
                                    { aliases: [entry.alias] }
                                  )
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
                          sharedFormulaEditor(step.step_id, step.message.formula_id)
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
                        formulaSearchContexts={formulaSearchContexts}
                        mutationTargets={mutationTargets}
                        formulas={formulas}
                      />
                    ) : step.type === "resolve_damage" ? (
                      <div className="list-item list-item--block" key={step.step_id}>
                        <div className="inline-group">
                          <Field label="Damage Type">
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
                                  updateResolveDamageActionStep(values, step.step_id, {
                                    amountText
                                  })
                                )
                              }
                              onVariableSelect={(entry, amountText) => {
                                if (!isInlineFormula(step.amount)) {
                                  return;
                                }
                                onChange(
                                  ensureActionProficienciesForFormula(
                                    updateResolveDamageActionStepFormula(values, step.step_id, {
                                      amountText,
                                      aliases: upsertFormulaAlias(
                                        step.amount.aliases ?? null,
                                        entry.alias
                                      )
                                    }),
                                    { aliases: [entry.alias] }
                                  )
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
                          sharedFormulaEditor(step.step_id, step.amount.formula_id)
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
                          <CatalogEntityPicker
                            catalog="proficiencies"
                            label="Proficiency"
                            required
                            invalid={
                              validationAttempted &&
                              (!step.proficiency_id ||
                                !proficiencies.some(
                                  (proficiency) => proficiency.id === step.proficiency_id
                                ))
                            }
                            placeholder="Search proficiency catalog"
                            selectedId={step.proficiency_id}
                            options={[
                              ...(!step.proficiency_id ||
                              proficiencies.some(
                                (proficiency) => proficiency.id === step.proficiency_id
                              )
                                ? []
                                : [
                                    {
                                      id: step.proficiency_id,
                                      label: `Missing proficiency: ${step.proficiency_id}`,
                                      disabledReason: "Missing definition",
                                      value: step.proficiency_id
                                    }
                                  ]),
                              ...proficiencies.map((proficiency) => ({
                                id: proficiency.id,
                                label: proficiency.name,
                                secondary: proficiency.description,
                                keywords: [proficiency.id],
                                value: proficiency.id
                              }))
                            ]}
                            emptyMessage="No proficiencies available."
                            onSelect={(proficiencyId) =>
                              onChange(
                                updateGainProficiencyUseActionStep(values, step.step_id, {
                                  proficiencyId
                                })
                              )
                            }
                          />
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
                                  ensureActionProficienciesForFormula(
                                    updateGainProficiencyUseActionStepFormula(
                                      values,
                                      step.step_id,
                                      {
                                        amountText,
                                        aliases: upsertFormulaAlias(
                                          step.amount.aliases ?? null,
                                          entry.alias
                                        )
                                      }
                                    ),
                                    { aliases: [entry.alias] }
                                  )
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
                          sharedFormulaEditor(step.step_id, step.amount.formula_id)
                        ) : (
                          <p className="muted">
                            Reuses {step.amount.variable_id} directly without reevaluating its
                            formula.
                          </p>
                        )}
                      </div>
                    ) : step.type === "adjust_action_points" ? (
                      <ActionPointsStepEditor
                        step={step}
                        values={values}
                        onChange={onChange}
                        validationAttempted={validationAttempted}
                      />
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

        <FormValidationSummary
          visible={validationAttempted && Boolean(validationError)}
          message={
            requiredFieldMissing
              ? "Complete all required fields."
              : (validationError ?? "Review the indicated fields.")
          }
        />
        <div className="template-editor__actions action-editor__footer">
          <button className="button" onClick={onSubmit} disabled={pending}>
            {pending
              ? editingActionId
                ? "Saving…"
                : "Creating…"
              : editingActionId
                ? "Save Action"
                : "Create Action"}
          </button>
          <button className="button button--secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
