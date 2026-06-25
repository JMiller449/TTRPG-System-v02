import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import type { GameClient } from "@/hooks/useGameClient";
import { ActionDefinitionList } from "@/features/actions/components/ActionDefinitionList";
import { ActionEditorForm } from "@/features/actions/components/ActionEditorForm";
import { ActionStepMetadataPanel } from "@/features/actions/components/ActionStepMetadataPanel";
import {
  createEmptyActionEditorValues,
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

export function ActionAuthoringPage({ client }: { client: GameClient }): JSX.Element {
  const {
    state: {
      serverState: {
        actions: actionRecords,
        actionOrder,
        proficiencies: proficiencyRecords,
        proficiencyOrder
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
      ? buildUpdateActionSubmission(actionRecords[editingActionId], values)
      : buildCreateActionSubmission(values, makeId("action"));
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
        <ActionEditorForm
          editingActionId={editingActionId}
          values={values}
          onChange={setValues}
          onSubmit={onSubmit}
          onCancel={startNewAction}
          metadata={actionFormulaAuthoringMetadata}
          proficiencies={proficiencies}
        />

        <ActionStepMetadataPanel metadata={actionFormulaAuthoringMetadata} />

        <ActionDefinitionList
          actions={actions}
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
