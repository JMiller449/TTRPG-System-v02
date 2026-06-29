import type { Augmentation, ConditionPreset } from "@/domain/models";
import {
  moveActionStep,
  removeActionStep,
  updateApplyAugmentationActionStep,
  updateApplyConditionPresetActionStep,
  type ActionEditorValues,
  type ApplyAugmentationEditorStep,
  type ApplyConditionPresetEditorStep
} from "@/features/actions/actionEditorValues";
import { Field } from "@/shared/ui/Field";

export function ActionRecordStepEditor({
  step,
  values,
  onChange,
  augmentations,
  conditions
}: {
  step: ApplyAugmentationEditorStep | ApplyConditionPresetEditorStep;
  values: ActionEditorValues;
  onChange: (values: ActionEditorValues) => void;
  augmentations: Augmentation[];
  conditions: ConditionPreset[];
}): JSX.Element {
  const isAugmentation = step.type === "apply_augmentation";
  const currentId = isAugmentation ? step.augmentation_id : step.condition_id;
  const records = isAugmentation
    ? augmentations.map((augmentation) => ({ id: augmentation.id, name: augmentation.name }))
    : conditions.map((condition) => ({ id: condition.id, name: condition.name }));

  return (
    <div className="list-item list-item--block">
      <div className="inline-group">
        <Field label={`${isAugmentation ? "Augmentation" : "Condition"}: ${step.step_id}`}>
          <select
            value={currentId}
            onChange={(event) =>
              onChange(
                isAugmentation
                  ? updateApplyAugmentationActionStep(values, step.step_id, {
                      augmentationId: event.target.value
                    })
                  : updateApplyConditionPresetActionStep(values, step.step_id, {
                      conditionId: event.target.value
                    })
              )
            }
          >
            {records.some((record) => record.id === currentId) ? null : (
              <option value={currentId} disabled>
                Missing record: {currentId}
              </option>
            )}
            {records.map((record) => (
              <option key={record.id} value={record.id}>
                {record.name} ({record.id})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Operation">
          <select
            value={step.operation ?? "apply"}
            onChange={(event) =>
              onChange(
                isAugmentation
                  ? updateApplyAugmentationActionStep(values, step.step_id, {
                      operation: event.target.value as "apply" | "remove"
                    })
                  : updateApplyConditionPresetActionStep(values, step.step_id, {
                      operation: event.target.value as "apply" | "remove"
                    })
              )
            }
          >
            <option value="apply">Apply</option>
            <option value="remove">Remove</option>
          </select>
        </Field>
      </div>
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
          onClick={() => onChange(removeActionStep(values, step.step_id))}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
