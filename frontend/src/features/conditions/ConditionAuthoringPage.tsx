import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import type { GameClient } from "@/hooks/useGameClient";
import { ConditionAugmentationTemplatePanel } from "@/features/conditions/components/ConditionAugmentationTemplatePanel";
import { ConditionPresetEditorForm } from "@/features/conditions/components/ConditionPresetEditorForm";
import {
  createEmptyAugmentationEditorValues,
  hasValidAugmentationEditorValues,
  isKnownAugmentationEditorTarget,
  toAugmentationEditorValues,
  type AugmentationEditorValues
} from "@/features/augmentations/augmentationEditorValues";
import { buildAugmentationSelectorOptions } from "@/features/augmentations/augmentationSelectorOptions";
import {
  buildCreateConditionPresetSubmission,
  buildDeleteConditionPresetSubmission,
  buildLoadConditionAugmentationTargetMetadataSubmission,
  buildUpdateConditionPresetSubmission,
  selectOrderedConditionPresets
} from "@/features/conditions/conditionAuthoringRequests";
import {
  createEmptyConditionPresetEditorValues,
  removeConditionEffect,
  toConditionAugmentationTemplatePayload,
  toConditionPresetEditorValues,
  upsertConditionEffect,
  type ConditionPresetEditorValues
} from "@/features/conditions/conditionEditorValues";
import { Panel } from "@/shared/ui/Panel";
import { CatalogEditorLayout } from "@/shared/ui/CatalogEditorLayout";
import { CatalogTileGrid } from "@/shared/ui/CatalogTileGrid";
import { makeId } from "@/shared/utils/id";
import { buildLoadActionFormulaAuthoringMetadataSubmission } from "@/features/actions/actionAuthoringRequests";

export function ConditionAuthoringPage({ client }: { client: GameClient }): JSX.Element {
  const {
    state: {
      serverState: {
        conditionPresets,
        conditionPresetOrder,
        actions: actionRecords,
        actionOrder,
        formulas: formulaRecords,
        formulaOrder
      },
      uiState: { augmentationTargetMetadata, actionFormulaAuthoringMetadata }
    }
  } = useAppStore();

  const [editingConditionId, setEditingConditionId] = useState<string | null>(null);
  const [pendingCreatedConditionId, setPendingCreatedConditionId] = useState<string | null>(null);
  const [values, setValues] = useState<ConditionPresetEditorValues>(
    createEmptyConditionPresetEditorValues
  );
  const [editingAugmentationId, setEditingAugmentationId] = useState<string | null>(null);
  const [effectEditorOpen, setEffectEditorOpen] = useState(false);
  const [augmentationValues, setAugmentationValues] = useState<AugmentationEditorValues>(
    createEmptyAugmentationEditorValues
  );

  const conditions = useMemo(
    () => selectOrderedConditionPresets(conditionPresets, conditionPresetOrder),
    [conditionPresetOrder, conditionPresets]
  );
  const selectorOptions = useMemo(
    () =>
      buildAugmentationSelectorOptions({
        actionRecords,
        actionOrder,
        formulaRecords,
        formulaOrder
      }),
    [actionOrder, actionRecords, formulaOrder, formulaRecords]
  );
  const targetOptions =
    augmentationTargetMetadata?.context === "condition_template"
      ? augmentationTargetMetadata.targets
      : [];

  useEffect(() => {
    if (augmentationTargetMetadata?.context === "condition_template") {
      return;
    }

    const submission = buildLoadConditionAugmentationTargetMetadataSubmission();
    client.sendProtocolRequest(submission.request, submission.label);
  }, [augmentationTargetMetadata?.context, client]);

  useEffect(() => {
    if (actionFormulaAuthoringMetadata) {
      return;
    }
    const submission = buildLoadActionFormulaAuthoringMetadataSubmission();
    client.sendProtocolRequest(submission.request, submission.label);
  }, [actionFormulaAuthoringMetadata, client]);

  useEffect(() => {
    if (!pendingCreatedConditionId) {
      return;
    }
    const createdCondition = conditionPresets[pendingCreatedConditionId];
    if (!createdCondition) {
      return;
    }

    setEditingConditionId(createdCondition.id);
    setValues(toConditionPresetEditorValues(createdCondition));
    setPendingCreatedConditionId(null);
  }, [conditionPresets, pendingCreatedConditionId]);

  useEffect(() => {
    if (!editingConditionId || conditionPresets[editingConditionId]) {
      return;
    }

    setEditingConditionId(null);
    setValues(createEmptyConditionPresetEditorValues());
    setEditingAugmentationId(null);
    setAugmentationValues(createEmptyAugmentationEditorValues());
    setEffectEditorOpen(false);
  }, [conditionPresets, editingConditionId]);

  const resetAugmentationEditor = (): void => {
    setEditingAugmentationId(null);
    setAugmentationValues(createEmptyAugmentationEditorValues());
    setEffectEditorOpen(false);
  };

  const startNewCondition = (): void => {
    setEditingConditionId(null);
    setPendingCreatedConditionId(null);
    setValues(createEmptyConditionPresetEditorValues());
    resetAugmentationEditor();
  };

  const onSubmit = (): void => {
    const conditionId = editingConditionId ?? makeId("condition");
    const submission = editingConditionId
      ? buildUpdateConditionPresetSubmission(conditionPresets[editingConditionId], values)
      : buildCreateConditionPresetSubmission(values, conditionId);
    if (!submission) {
      return;
    }

    client.sendProtocolRequest(submission.request, submission.label);
    if (!editingConditionId) {
      setPendingCreatedConditionId(conditionId);
    }
  };

  const deleteCondition = (conditionId: string): void => {
    const condition = conditionPresets[conditionId];
    const submission = buildDeleteConditionPresetSubmission(conditionId, condition);
    if (!submission.confirmation || !window.confirm(submission.confirmation)) {
      return;
    }
    client.sendProtocolRequest(submission.request, submission.label);
  };

  const submitAugmentation = (): void => {
    if (
      !hasValidAugmentationEditorValues(augmentationValues) ||
      !isKnownAugmentationEditorTarget(augmentationValues, targetOptions)
    ) {
      return;
    }
    const augmentation = toConditionAugmentationTemplatePayload({
      values: augmentationValues,
      augmentationId: editingAugmentationId ?? makeId("condition_effect"),
      conditionId: editingConditionId ?? pendingCreatedConditionId ?? "draft-condition",
      conditionName: values.name
    });
    if (!augmentation) {
      return;
    }

    setValues((current) => upsertConditionEffect(current, augmentation));
    resetAugmentationEditor();
  };

  const removeAugmentation = (augmentationId: string): void => {
    setValues((current) => removeConditionEffect(current, augmentationId));
    if (editingAugmentationId === augmentationId) {
      resetAugmentationEditor();
    }
  };

  return (
    <Panel
      title="Condition Authoring"
      subtitle="Status conditions like Poisoned or Stunned, plus the effects they apply while active."
      actions={
        editingConditionId ? (
          <div className="inline-actions">
            <button className="button button--secondary" onClick={startNewCondition}>
              New Condition
            </button>
            <button
              className="button button--danger"
              onClick={() => deleteCondition(editingConditionId)}
            >
              Delete Condition
            </button>
          </div>
        ) : null
      }
    >
      <CatalogEditorLayout
        catalogLabel="Condition Catalog"
        catalog={
          <CatalogTileGrid
            items={conditions.map((condition) => ({ id: condition.id, name: condition.name }))}
            selectedId={editingConditionId}
            emptyMessage="No conditions created yet."
            onSelect={(conditionId) => {
              const condition = conditionPresets[conditionId];
              if (!condition) {
                return;
              }
              setEditingConditionId(condition.id);
              setPendingCreatedConditionId(null);
              setValues(toConditionPresetEditorValues(condition));
              resetAugmentationEditor();
            }}
          />
        }
      >
        <ConditionPresetEditorForm
          editingConditionId={editingConditionId}
          values={values}
          onChange={setValues}
          onSubmit={onSubmit}
          onCancel={startNewCondition}
          hasOpenEffectEditor={effectEditorOpen}
          effectEditor={
            <ConditionAugmentationTemplatePanel
              conditionName={values.name.trim() || "New condition"}
              editorOpen={effectEditorOpen}
              editingAugmentationId={editingAugmentationId}
              templates={values.augmentationTemplates}
              targetOptions={targetOptions}
              selectorOptions={selectorOptions}
              formulaMetadata={actionFormulaAuthoringMetadata}
              values={augmentationValues}
              onChange={setAugmentationValues}
              onAdd={() => {
                setEditingAugmentationId(null);
                setAugmentationValues(createEmptyAugmentationEditorValues());
                setEffectEditorOpen(true);
              }}
              onSubmit={submitAugmentation}
              onCancel={resetAugmentationEditor}
              onEdit={(augmentation) => {
                setEditingAugmentationId(augmentation.id);
                setAugmentationValues(toAugmentationEditorValues(augmentation));
                setEffectEditorOpen(true);
              }}
              onRemove={removeAugmentation}
            />
          }
        />
      </CatalogEditorLayout>
    </Panel>
  );
}
