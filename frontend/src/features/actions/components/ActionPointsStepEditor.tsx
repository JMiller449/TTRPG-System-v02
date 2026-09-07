import {
  updateAdjustActionPointsActionStep,
  type ActionEditorValues,
  type AdjustActionPointsEditorStep
} from "@/features/actions/actionEditorValues";
import { Field } from "@/shared/ui/Field";

export function ActionPointsStepEditor({
  step,
  values,
  onChange,
  validationAttempted
}: {
  step: AdjustActionPointsEditorStep;
  values: ActionEditorValues;
  onChange: (values: ActionEditorValues) => void;
  validationAttempted: boolean;
}): JSX.Element {
  const amount = step.amount ?? 1;
  const amountInvalid = !Number.isSafeInteger(amount) || amount <= 0;
  return (
    <div className="list-item list-item--block">
      <Field label="Operation">
        <select
          value={step.operation ?? "consume"}
          onChange={(event) =>
            onChange(
              updateAdjustActionPointsActionStep(values, step.step_id, {
                operation: event.target.value as "consume" | "restore"
              })
            )
          }
        >
          <option value="consume">Consume</option>
          <option value="restore">Restore</option>
        </select>
      </Field>
      <Field label="Action point amount" required invalid={validationAttempted && amountInvalid}>
        <input
          type="number"
          min="1"
          step="1"
          value={Number.isNaN(amount) ? "" : amount}
          aria-invalid={validationAttempted && amountInvalid}
          onChange={(event) =>
            onChange(
              updateAdjustActionPointsActionStep(values, step.step_id, {
                amount: event.target.valueAsNumber
              })
            )
          }
        />
      </Field>
      <p className="muted">
        Uses the acting character’s shared Action / Reaction Points pool. The action fails if there
        are too few points to consume or restoration would exceed the maximum.
      </p>
    </div>
  );
}
