import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import type { GameClient } from "@/hooks/useGameClient";
import { ActionEditorForm } from "@/features/actions/components/ActionEditorForm";
import { ActionAttributesEditor } from "@/features/actions/components/ActionAttributesEditor";
import { ActionPresetPicker } from "@/features/actions/components/ActionPresetPicker";
import {
  applyActionPresetTemplate,
  createEmptyActionEditorValues,
  getActionEditorValidationError,
  toActionEditorValues,
  type ActionEditorValues
} from "@/features/actions/actionEditorValues";
import {
  buildCreateActionSubmission,
  buildDeleteActionSubmission,
  buildLoadActionFormulaAuthoringMetadataSubmission,
  buildUpdateActionSubmission,
  selectOrderedActionDefinitions
} from "@/features/actions/actionAuthoringRequests";
import { Panel } from "@/shared/ui/Panel";
import { CatalogEditorLayout } from "@/shared/ui/CatalogEditorLayout";
import { CatalogTileGrid } from "@/shared/ui/CatalogTileGrid";
import { confirmDestructiveAction } from "@/shared/ui/confirmDestructiveAction";
import { makeId } from "@/shared/utils/id";
import type { ConditionPreset, StandaloneEffectDefinition } from "@/domain/models";

export function ActionAuthoringPage({ client }: { client: GameClient }): JSX.Element {
  const {
    state: {
      serverState: {
        actions: actionRecords,
        actionOrder,
        formulas: formulaRecords,
        formulaOrder,
        standaloneEffects: standaloneEffectRecords,
        standaloneEffectOrder,
        conditionPresets,
        conditionPresetOrder,
        proficiencies: proficiencyRecords,
        proficiencyOrder,
        attributes: attributeDefinitions
      },
      uiState: { actionFormulaAuthoringMetadata, intentFeedback }
    }
  } = useAppStore();
  const requestedMetadataRef = useRef(false);

  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [values, setValues] = useState<ActionEditorValues>(createEmptyActionEditorValues);
  const [pendingSave, setPendingSave] = useState<{
    requestId: string;
    actionId: string;
    operation: "create" | "update";
  } | null>(null);
  const [saveConfirmation, setSaveConfirmation] = useState<string | null>(null);

  const actions = useMemo(
    () => selectOrderedActionDefinitions(actionRecords, actionOrder),
    [actionOrder, actionRecords]
  );
  const proficiencies = useMemo(
    () =>
      proficiencyOrder
        .map((proficiencyId) => proficiencyRecords[proficiencyId])
        .filter((proficiency) => Boolean(proficiency)),
    [proficiencyOrder, proficiencyRecords]
  );
  const formulas = useMemo(
    () =>
      formulaOrder
        .map((formulaId) => formulaRecords[formulaId])
        .filter((formula) => Boolean(formula)),
    [formulaOrder, formulaRecords]
  );
  const standaloneEffects = useMemo(
    () =>
      standaloneEffectOrder
        .map((effectId) => standaloneEffectRecords[effectId])
        .filter(
          (effect): effect is StandaloneEffectDefinition =>
            effect?.target.root === "instance" && effect.scope === "instance"
        ),
    [standaloneEffectOrder, standaloneEffectRecords]
  );
  const conditions = useMemo(
    () =>
      conditionPresetOrder
        .map((conditionId) => conditionPresets[conditionId])
        .filter((condition): condition is ConditionPreset => Boolean(condition)),
    [conditionPresetOrder, conditionPresets]
  );
  const attributeValidationContext = {
    definitions: attributeDefinitions,
    proficiencies: proficiencyRecords
  };
  const validationError = getActionEditorValidationError(values, attributeValidationContext);
  const draftHasContent = Boolean(
    values.name.trim() ||
    values.notes.trim() ||
    values.steps.length ||
    Object.keys(values.attributes).length
  );

  const startNewAction = (): void => {
    if (pendingSave) {
      return;
    }
    setEditingActionId(null);
    setValues(createEmptyActionEditorValues());
    setSaveConfirmation(null);
  };

  useEffect(() => {
    if (actionFormulaAuthoringMetadata || requestedMetadataRef.current) {
      return;
    }

    requestedMetadataRef.current = true;
    const submission = buildLoadActionFormulaAuthoringMetadataSubmission();
    client.sendProtocolRequest(submission.request, submission.label);
  }, [actionFormulaAuthoringMetadata, client]);

  useEffect(() => {
    if (!pendingSave) {
      return;
    }
    const feedback = intentFeedback.find((entry) => entry.intentId === pendingSave.requestId);
    if (!feedback || feedback.status === "pending") {
      return;
    }
    if (feedback.status === "error") {
      setPendingSave(null);
      return;
    }
    const savedAction = actionRecords[pendingSave.actionId];
    if (!savedAction) {
      return;
    }
    setEditingActionId(savedAction.id);
    setValues(toActionEditorValues(savedAction));
    setSaveConfirmation(
      pendingSave.operation === "create"
        ? `Action “${savedAction.name}” created.`
        : `Action “${savedAction.name}” saved.`
    );
    setPendingSave(null);
  }, [actionRecords, intentFeedback, pendingSave]);

  const onSubmit = (): void => {
    if (pendingSave || validationError) {
      return;
    }

    const actionId = editingActionId ?? makeId("action");
    const requestId = makeId("request");
    const submission = editingActionId
      ? buildUpdateActionSubmission(
          actionRecords[editingActionId],
          values,
          attributeValidationContext
        )
      : buildCreateActionSubmission(values, actionId, attributeValidationContext);
    if (!submission) {
      return;
    }

    setSaveConfirmation(null);
    setPendingSave({
      requestId,
      actionId,
      operation: editingActionId ? "update" : "create"
    });
    client.sendProtocolRequest({ ...submission.request, request_id: requestId }, submission.label);
  };

  const deleteAction = (actionId: string): void => {
    const action = actionRecords[actionId];
    if (
      !confirmDestructiveAction({
        action: "Delete",
        subject: action?.name ?? actionId,
        consequence:
          "This permanently deletes the action definition. Existing dependency checks still apply."
      })
    ) {
      return;
    }
    const submission = buildDeleteActionSubmission(actionId, action);
    client.sendProtocolRequest(submission.request, submission.label);
    if (editingActionId === actionId) {
      startNewAction();
    }
  };

  return (
    <Panel
      className="action-authoring-panel"
      title="Action Authoring"
      subtitle="Build the rollable moves used at the table. An action is a list of steps that run in order when it is performed."
      actions={
        editingActionId ? (
          <div className="inline-actions">
            <button
              className="button button--secondary"
              onClick={startNewAction}
              disabled={Boolean(pendingSave)}
            >
              New Action
            </button>
            <button
              className="button button--danger"
              onClick={() => deleteAction(editingActionId)}
              disabled={Boolean(pendingSave)}
            >
              Delete Action
            </button>
          </div>
        ) : null
      }
    >
      <CatalogEditorLayout
        catalogLabel="Authored Actions"
        editorClassName="authoring-workspace__editor--vertical"
        catalog={
          <CatalogTileGrid
            items={actions.map((action) => ({ id: action.id, name: action.name }))}
            selectedId={editingActionId}
            emptyMessage="No actions created yet."
            onSelect={(actionId) => {
              if (pendingSave) {
                return;
              }
              const action = actionRecords[actionId];
              if (!action) {
                return;
              }
              setEditingActionId(action.id);
              setValues(toActionEditorValues(action));
              setSaveConfirmation(null);
            }}
          />
        }
      >
        <div className="stack action-authoring-editor">
          <ActionPresetPicker
            presets={actionFormulaAuthoringMetadata?.action_preset_templates ?? []}
            disabled={Boolean(pendingSave)}
            onApply={(preset) => {
              if (pendingSave) {
                return;
              }
              setEditingActionId(null);
              setValues(
                applyActionPresetTemplate(
                  createEmptyActionEditorValues(),
                  preset,
                  attributeDefinitions,
                  () => makeId("action_attribute")
                )
              );
              setSaveConfirmation(null);
            }}
          />
          {saveConfirmation ? (
            <p className="action-authoring-feedback" role="status">
              {saveConfirmation}
            </p>
          ) : null}
          <ActionEditorForm
            editingActionId={editingActionId}
            values={values}
            onChange={(nextValues) => {
              setValues(nextValues);
              setSaveConfirmation(null);
            }}
            onSubmit={onSubmit}
            onCancel={startNewAction}
            metadata={actionFormulaAuthoringMetadata}
            proficiencies={proficiencies}
            formulas={formulas}
            standaloneEffects={standaloneEffects}
            conditions={conditions}
            validationError={validationError}
            showValidationError={draftHasContent}
            pending={Boolean(pendingSave)}
            attributesEditor={
              <ActionAttributesEditor
                values={values}
                definitions={attributeDefinitions}
                proficiencies={proficiencyRecords}
                metadata={actionFormulaAuthoringMetadata}
                onChange={setValues}
              />
            }
          />
        </div>
      </CatalogEditorLayout>
    </Panel>
  );
}
