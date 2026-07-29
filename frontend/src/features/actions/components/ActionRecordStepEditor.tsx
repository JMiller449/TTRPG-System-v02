import type { ConditionPreset, StandaloneEffectDefinition } from "@/domain/models";
import {
  updateApplyAugmentationActionStep,
  updateApplyConditionPresetActionStep,
  type ActionEditorValues,
  type ApplyAugmentationEditorStep,
  type ApplyConditionPresetEditorStep
} from "@/features/actions/actionEditorValues";
import { Field } from "@/shared/ui/Field";
import { CatalogEntityPicker } from "@/features/catalogs/CatalogEntityPicker";

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
        <CatalogEntityPicker
          catalog={isAugmentation ? "effects" : "conditions"}
          label={`${isAugmentation ? "Standalone Effect" : "Condition"}: ${step.step_id}`}
          placeholder={`Search ${isAugmentation ? "effect" : "condition"} catalog`}
          selectedId={currentId}
          options={[
            ...(!currentId || records.some((record) => record.id === currentId)
              ? []
              : [
                  {
                    id: currentId,
                    label: `Missing record: ${currentId}`,
                    disabledReason: "Missing definition",
                    value: currentId
                  }
                ]),
            ...records.map((record) => ({
              id: record.id,
              label: record.name,
              keywords: [record.id],
              value: record.id
            }))
          ]}
          emptyMessage={`No ${isAugmentation ? "effects" : "conditions"} available.`}
          onSelect={(recordId) =>
            onChange(
              isAugmentation
                ? updateApplyAugmentationActionStep(values, step.step_id, {
                    augmentationId: recordId
                  })
                : updateApplyConditionPresetActionStep(values, step.step_id, {
                    conditionId: recordId
                  })
            )
          }
        />
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
