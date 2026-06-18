import { Field } from "@/shared/ui/Field";
import {
  addSendMessageActionStep,
  moveSendMessageActionStep,
  removeSendMessageActionStep,
  updateSendMessageActionStepText,
  type ActionEditorValues
} from "@/features/actions/actionEditorValues";
import { makeId } from "@/shared/utils/id";

export function ActionEditorForm({
  editingActionId,
  values,
  onChange,
  onSubmit,
  onCancel
}: {
  editingActionId: string | null;
  values: ActionEditorValues;
  onChange: (values: ActionEditorValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
}): JSX.Element {
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
            <button
              className="button button--secondary"
              onClick={() => onChange(addSendMessageActionStep(values, makeId("step")))}
            >
              Add Message
            </button>
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
