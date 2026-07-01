import type { ConditionPreset, StandaloneEffectDefinition } from "@/domain/models";
import {
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
  standaloneEffects,
  conditions
}: {
  step: ApplyAugmentationEditorStep | ApplyConditionPresetEditorStep;
  values: ActionEditorValues;
  onChange: (values: ActionEditorValues) => void;
  standaloneEffects: StandaloneEffectDefinition[];
  conditions: ConditionPreset[];
}): JSX.Element {
  const isAugmentation = step.type === "apply_augmentation";
  const currentId = isAugmentation ? step.augmentation_id : step.condition_id;
  const records = isAugmentation
    ? standaloneEffects.map((effect) => ({ id: effect.id, name: effect.name }))
    : conditions.map((condition) => ({ id: condition.id, name: condition.name }));

  return (
    <div className="list-item list-item--block">
      <div className="inline-group">
        <Field label={`${isAugmentation ? "Standalone Effect" : "Condition"}: ${step.step_id}`}>
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
    </div>
  );
}
