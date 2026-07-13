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
      uiState: { actionFormulaAuthoringMetadata }
    }
  } = useAppStore();
  const requestedMetadataRef = useRef(false);

  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [values, setValues] = useState<ActionEditorValues>(createEmptyActionEditorValues);

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

  const startNewAction = (): void => {
    setEditingActionId(null);
    setValues(createEmptyActionEditorValues());
  };

  useEffect(() => {
    if (actionFormulaAuthoringMetadata || requestedMetadataRef.current) {
      return;
    }

    requestedMetadataRef.current = true;
    const submission = buildLoadActionFormulaAuthoringMetadataSubmission();
    client.sendProtocolRequest(submission.request, submission.label);
  }, [actionFormulaAuthoringMetadata, client]);

  const onSubmit = (): void => {
    if (!values.name.trim()) {
      return;
    }

    const submission = editingActionId
      ? buildUpdateActionSubmission(
          actionRecords[editingActionId],
          values,
          attributeValidationContext
        )
      : buildCreateActionSubmission(values, makeId("action"), attributeValidationContext);
    if (!submission) {
      return;
    }

    client.sendProtocolRequest(submission.request, submission.label);
    startNewAction();
  };

  const deleteAction = (actionId: string): void => {
    const submission = buildDeleteActionSubmission(actionId, actionRecords[actionId]);
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
            <button className="button button--secondary" onClick={startNewAction}>
              New Action
            </button>
            <button className="button button--danger" onClick={() => deleteAction(editingActionId)}>
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
              const action = actionRecords[actionId];
              if (!action) {
                return;
              }
              setEditingActionId(action.id);
              setValues(toActionEditorValues(action));
            }}
          />
        }
      >
        <div className="stack action-authoring-editor">
          <ActionPresetPicker
            presets={actionFormulaAuthoringMetadata?.action_preset_templates ?? []}
            onApply={(preset) => {
              setEditingActionId(null);
              setValues(
                applyActionPresetTemplate(
                  createEmptyActionEditorValues(),
                  preset,
                  attributeDefinitions,
                  () => makeId("action_attribute")
                )
              );
            }}
          />
          <ActionEditorForm
            editingActionId={editingActionId}
            values={values}
            onChange={setValues}
            onSubmit={onSubmit}
            onCancel={startNewAction}
            metadata={actionFormulaAuthoringMetadata}
            proficiencies={proficiencies}
            formulas={formulas}
            standaloneEffects={standaloneEffects}
            conditions={conditions}
            validationError={validationError}
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
