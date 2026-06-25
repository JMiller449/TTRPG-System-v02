import { Field } from "@/shared/ui/Field";
import { DAMAGE_TYPES, type DamageType, type ProficiencyDefinition } from "@/domain/models";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import {
  addGainProficiencyUseActionStep,
  addResolveDamageActionStep,
  addSendMessageActionStep,
  moveGainProficiencyUseActionStep,
  moveResolveDamageActionStep,
  moveSendMessageActionStep,
  removeGainProficiencyUseActionStep,
  removeResolveDamageActionStep,
  removeSendMessageActionStep,
  updateGainProficiencyUseActionStep,
  updateGainProficiencyUseActionStepFormula,
  updateResolveDamageActionStep,
  updateResolveDamageActionStepFormula,
  updateSendMessageActionStepText,
  updateSendMessageActionStepFormula,
  type ActionEditorValues
} from "@/features/actions/actionEditorValues";
import { VariablePathBrowser } from "@/features/variables/components/VariablePathBrowser";
import {
  appendFormulaToken,
  upsertFormulaAlias,
  type VariablePickerEntry
} from "@/features/variables/variablePicker";
import { makeId } from "@/shared/utils/id";

export function ActionEditorForm({
  editingActionId,
  values,
  onChange,
  onSubmit,
  onCancel,
  metadata,
  proficiencies
}: {
  editingActionId: string | null;
  values: ActionEditorValues;
  onChange: (values: ActionEditorValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
  metadata: ActionFormulaAuthoringMetadata | null;
  proficiencies: ProficiencyDefinition[];
}): JSX.Element {
  const defaultProficiencyId = proficiencies[0]?.id ?? "";

  const insertIntoMessageStep = (stepId: string, entry: VariablePickerEntry): void => {
    const step = values.steps.find(
      (candidate) => candidate.step_id === stepId && candidate.type === "send_message"
    );
    if (!step || step.type !== "send_message") {
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
    if (!step || step.type !== "resolve_damage") {
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
    if (!step || step.type !== "gain_proficiency_use") {
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
                disabled={!defaultProficiencyId}
                onClick={() =>
                  onChange(addGainProficiencyUseActionStep(values, makeId("proficiency"), defaultProficiencyId))
                }
              >
                Add Proficiency
              </button>
            </div>
          </div>
          <div className="list">
            {values.steps.map((step) =>
              step.type === "send_message" ? (
                <div className="list-item list-item--block" key={step.step_id}>
                  <Field label={`Message Step: ${step.step_id}`}>
                    <textarea
                      rows={3}
                      value={step.message.text}
                      onChange={(event) =>
                        onChange(updateSendMessageActionStepText(values, step.step_id, event.target.value))
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
                  <div className="inline-actions">
                    <button
                      className="button button--secondary"
                      onClick={() => onChange(moveSendMessageActionStep(values, step.step_id, "up"))}
                    >
                      Up
                    </button>
                    <button
                      className="button button--secondary"
                      onClick={() => onChange(moveSendMessageActionStep(values, step.step_id, "down"))}
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
                  </div>
                  <VariablePathBrowser
                    metadata={metadata}
                    mode="formula"
                    title="Damage Amount Variables"
                    onPick={(entry) => insertIntoDamageStep(step.step_id, entry)}
                  />
                  <div className="inline-actions">
                    <button
                      className="button button--secondary"
                      onClick={() => onChange(moveResolveDamageActionStep(values, step.step_id, "up"))}
                    >
                      Up
                    </button>
                    <button
                      className="button button--secondary"
                      onClick={() => onChange(moveResolveDamageActionStep(values, step.step_id, "down"))}
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
                        {proficiencies.some((proficiency) => proficiency.id === step.proficiency_id) ? null : (
                          <option value={step.proficiency_id}>{step.proficiency_id}</option>
                        )}
                        {proficiencies.map((proficiency) => (
                          <option key={proficiency.id} value={proficiency.id}>
                            {proficiency.name}
                          </option>
                        ))}
                      </select>
                    </Field>
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
                  </div>
                  <VariablePathBrowser
                    metadata={metadata}
                    mode="formula"
                    title="Use Amount Variables"
                    onPick={(entry) => insertIntoProficiencyStep(step.step_id, entry)}
                  />
                  <div className="inline-actions">
                    <button
                      className="button button--secondary"
                      onClick={() => onChange(moveGainProficiencyUseActionStep(values, step.step_id, "up"))}
                    >
                      Up
                    </button>
                    <button
                      className="button button--secondary"
                      onClick={() => onChange(moveGainProficiencyUseActionStep(values, step.step_id, "down"))}
                    >
                      Down
                    </button>
                    <button
                      className="button button--secondary"
                      onClick={() => onChange(removeGainProficiencyUseActionStep(values, step.step_id))}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                <div className="list-item list-item--block" key={step.step_id}>
                  <div className="list-item__top">
                    <strong>{step.step_id}</strong>
                    <span className="muted">{step.type}</span>
                  </div>
                </div>
              )
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
