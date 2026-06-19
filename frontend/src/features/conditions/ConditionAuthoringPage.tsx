import { useMemo, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import type { GameClient } from "@/hooks/useGameClient";
import { ConditionAugmentationTemplatePanel } from "@/features/conditions/components/ConditionAugmentationTemplatePanel";
import { ConditionPresetEditorForm } from "@/features/conditions/components/ConditionPresetEditorForm";
import { ConditionPresetList } from "@/features/conditions/components/ConditionPresetList";
import {
  createEmptyAugmentationEditorValues,
  toAugmentationEditorValues,
  type AugmentationEditorValues
} from "@/features/augmentations/augmentationEditorValues";
import {
  buildCreateConditionPresetSubmission,
  buildDeleteConditionPresetSubmission,
  buildRemoveConditionAugmentationSubmission,
  buildUpdateConditionPresetSubmission,
  buildUpsertConditionAugmentationSubmission,
  selectOrderedConditionPresets
} from "@/features/conditions/conditionAuthoringRequests";
import {
  createEmptyConditionPresetEditorValues,
  toConditionPresetEditorValues,
  type ConditionPresetEditorValues
} from "@/features/conditions/conditionEditorValues";
import { Panel } from "@/shared/ui/Panel";
import { makeId } from "@/shared/utils/id";

export function ConditionAuthoringPage({ client }: { client: GameClient }): JSX.Element {
  const {
    state: {
      serverState: { conditionPresets, conditionPresetOrder }
    }
  } = useAppStore();

  const [editingConditionId, setEditingConditionId] = useState<string | null>(null);
  const [values, setValues] = useState<ConditionPresetEditorValues>(
    createEmptyConditionPresetEditorValues
  );
  const [editingAugmentationId, setEditingAugmentationId] = useState<string | null>(null);
  const [augmentationValues, setAugmentationValues] = useState<AugmentationEditorValues>(
    createEmptyAugmentationEditorValues
  );

  const conditions = useMemo(
    () => selectOrderedConditionPresets(conditionPresets, conditionPresetOrder),
    [conditionPresetOrder, conditionPresets]
  );
  const selectedCondition = editingConditionId ? conditionPresets[editingConditionId] : undefined;

  const resetAugmentationEditor = (): void => {
    setEditingAugmentationId(null);
    setAugmentationValues(createEmptyAugmentationEditorValues());
  };

  const startNewCondition = (): void => {
    setEditingConditionId(null);
    setValues(createEmptyConditionPresetEditorValues());
    resetAugmentationEditor();
  };

  const onSubmit = (): void => {
    const submission = editingConditionId
      ? buildUpdateConditionPresetSubmission(conditionPresets[editingConditionId], values)
      : buildCreateConditionPresetSubmission(values, makeId("condition"));
    if (!submission) {
      return;
    }

    client.sendProtocolRequest(submission.request, submission.label);
    startNewCondition();
  };

  const deleteCondition = (conditionId: string): void => {
    const submission = buildDeleteConditionPresetSubmission(conditionId, conditionPresets[conditionId]);
    client.sendProtocolRequest(submission.request, submission.label);
    if (editingConditionId === conditionId) {
      startNewCondition();
    }
  };

  const submitAugmentation = (): void => {
    const submission = buildUpsertConditionAugmentationSubmission({
      condition: selectedCondition,
      values: augmentationValues,
      augmentationId: editingAugmentationId ?? makeId("condition_augmentation")
    });
    if (!submission) {
      return;
    }

    client.sendProtocolRequest(submission.request, submission.label);
    resetAugmentationEditor();
  };

  const removeAugmentation = (augmentationId: string): void => {
    const submission = buildRemoveConditionAugmentationSubmission({
      condition: selectedCondition,
      augmentationId
    });
    if (!submission) {
      return;
    }

    client.sendProtocolRequest(submission.request, submission.label);
    if (editingAugmentationId === augmentationId) {
      resetAugmentationEditor();
    }
  };

  return (
    <Panel
      title="Condition Authoring"
      actions={
        editingConditionId ? (
          <button className="button button--secondary" onClick={startNewCondition}>
            New Condition
          </button>
        ) : null
      }
    >
      <div className="stack">
        <ConditionPresetEditorForm
          editingConditionId={editingConditionId}
          values={values}
          onChange={setValues}
          onSubmit={onSubmit}
          onCancel={startNewCondition}
        />

        {selectedCondition ? (
          <ConditionAugmentationTemplatePanel
            conditionName={selectedCondition.name}
            editingAugmentationId={editingAugmentationId}
            templates={selectedCondition.augmentation_templates ?? []}
            values={augmentationValues}
            onChange={setAugmentationValues}
            onSubmit={submitAugmentation}
            onCancel={resetAugmentationEditor}
            onEdit={(augmentation) => {
              setEditingAugmentationId(augmentation.id);
              setAugmentationValues(toAugmentationEditorValues(augmentation));
            }}
            onRemove={removeAugmentation}
          />
        ) : null}

        <ConditionPresetList
          conditions={conditions}
          onEdit={(condition) => {
            setEditingConditionId(condition.id);
            setValues(toConditionPresetEditorValues(condition));
            resetAugmentationEditor();
          }}
          onDelete={deleteCondition}
        />
      </div>
    </Panel>
  );
}
