import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import type { GameClient } from "@/hooks/useGameClient";
import { ActionDefinitionList } from "@/features/actions/components/ActionDefinitionList";
import { ActionEditorForm } from "@/features/actions/components/ActionEditorForm";
import { ActionFactsEditor } from "@/features/actions/components/ActionFactsEditor";
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
        facts: factDefinitions
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
  const factValidationContext = {
    definitions: factDefinitions,
    proficiencies: proficiencyRecords
  };
  const validationError = getActionEditorValidationError(values, factValidationContext);

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
      ? buildUpdateActionSubmission(actionRecords[editingActionId], values, factValidationContext)
      : buildCreateActionSubmission(values, makeId("action"), factValidationContext);
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
      title="Action Authoring"
      actions={
        editingActionId ? (
          <button className="button button--secondary" onClick={startNewAction}>
            New Action
          </button>
        ) : null
      }
    >
      <div className="stack">
        <ActionPresetPicker
          presets={actionFormulaAuthoringMetadata?.action_preset_templates ?? []}
          onApply={(preset) => {
            setEditingActionId(null);
            setValues(
              applyActionPresetTemplate(
                createEmptyActionEditorValues(),
                preset,
                factDefinitions,
                () => makeId("action_fact")
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
          factsEditor={
            <ActionFactsEditor
              values={values}
              definitions={factDefinitions}
              proficiencies={proficiencyRecords}
              metadata={actionFormulaAuthoringMetadata}
              onChange={setValues}
            />
          }
        />

        <ActionDefinitionList
          actions={actions}
          factDefinitions={factDefinitions}
          onEdit={(action) => {
            setEditingActionId(action.id);
            setValues(toActionEditorValues(action));
          }}
          onDelete={deleteAction}
        />
      </div>
    </Panel>
  );
}
