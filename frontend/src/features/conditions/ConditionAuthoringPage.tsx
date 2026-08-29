import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import type { GameClient } from "@/hooks/useGameClient";
import { ConditionPresetEditorForm } from "@/features/conditions/components/ConditionPresetEditorForm";
import {
  buildCreateConditionPresetSubmission,
  buildDeleteConditionPresetSubmission,
  buildUpdateConditionPresetSubmission,
  selectOrderedConditionPresets
} from "@/features/conditions/conditionAuthoringRequests";
import {
  createEmptyConditionPresetEditorValues,
  hasValidConditionPresetValues,
  toConditionPresetEditorValues,
  type ConditionPresetEditorValues
} from "@/features/conditions/conditionEditorValues";
import { EffectReferenceEditor } from "@/features/effects/components/EffectReferenceEditor";
import { Panel } from "@/shared/ui/Panel";
import { CatalogEditorLayout } from "@/shared/ui/CatalogEditorLayout";
import { CatalogBrowser } from "@/features/catalogs/CatalogBrowser";
import { useCatalogCreationTarget } from "@/features/catalogs/useCatalogCreationTarget";
import { confirmDestructiveAction } from "@/shared/ui/confirmDestructiveAction";
import { makeId } from "@/shared/utils/id";
import { useFormValidationAttempt } from "@/shared/ui/useFormValidationAttempt";

export function ConditionAuthoringPage({ client }: { client: GameClient }): JSX.Element {
  const {
    state: {
      serverState: { conditionPresets, conditionPresetOrder, standaloneEffects }
    }
  } = useAppStore();

  const [editingConditionId, setEditingConditionId] = useState<string | null>(null);
  const [pendingCreatedConditionId, setPendingCreatedConditionId] = useState<string | null>(null);
  const [values, setValues] = useState<ConditionPresetEditorValues>(
    createEmptyConditionPresetEditorValues
  );
  const validation = useFormValidationAttempt();

  const conditions = useMemo(
    () => selectOrderedConditionPresets(conditionPresets, conditionPresetOrder),
    [conditionPresetOrder, conditionPresets]
  );
  const { beginCreation, queueCreatedEntry } = useCatalogCreationTarget({
    catalog: "conditions",
    client,
    entries: conditionPresets
  });
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
  }, [conditionPresets, editingConditionId]);

  const startNewCondition = (folderId: string | null = null): void => {
    validation.reset();
    beginCreation(folderId);
    setEditingConditionId(null);
    setPendingCreatedConditionId(null);
    setValues(createEmptyConditionPresetEditorValues());
  };

  const onSubmit = (): void => {
    if (!validation.validate(hasValidConditionPresetValues(values))) {
      return;
    }
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
      queueCreatedEntry(conditionId);
    }
  };

  const deleteCondition = (conditionId: string): void => {
    const condition = conditionPresets[conditionId];
    const submission = buildDeleteConditionPresetSubmission(conditionId, condition);
    if (
      !confirmDestructiveAction({
        action: "Delete",
        subject: condition?.name ?? conditionId,
        consequence:
          "This permanently deletes the condition preset. Existing action and active-condition dependency checks still apply."
      })
    ) {
      return;
    }
    client.sendProtocolRequest(submission.request, submission.label);
  };

  return (
    <Panel
      variant="workspace"
      title="Condition Authoring"
      subtitle="Status conditions like Poisoned or Stunned, plus the effects they apply while active."
      actions={
        editingConditionId ? (
          <div className="inline-actions">
            <button className="button button--secondary" onClick={() => startNewCondition()}>
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
        editorClassName="authoring-workspace__editor--vertical"
        catalog={
          <CatalogBrowser
            catalog="conditions"
            client={client}
            items={conditions.map((condition) => ({ id: condition.id, name: condition.name }))}
            selectedId={editingConditionId}
            entityLabel="condition"
            emptyMessage="No conditions created yet."
            onCreateEntry={startNewCondition}
            onSelect={(conditionId) => {
              const condition = conditionPresets[conditionId];
              if (!condition) {
                return;
              }
              beginCreation(null);
              setEditingConditionId(condition.id);
              setPendingCreatedConditionId(null);
              setValues(toConditionPresetEditorValues(condition));
              validation.reset();
            }}
          />
        }
      >
        <ConditionPresetEditorForm
          editingConditionId={editingConditionId}
          values={values}
          validationAttempted={validation.attempted}
          onChange={setValues}
          onSubmit={onSubmit}
          onCancel={startNewCondition}
          hasOpenEffectEditor={false}
          effectEditor={
            <EffectReferenceEditor
              effects={standaloneEffects}
              selectedIds={values.effectIds}
              onChange={(effectIds) => setValues((current) => ({ ...current, effectIds }))}
              label="Condition effects"
            />
          }
        />
      </CatalogEditorLayout>
    </Panel>
  );
}
