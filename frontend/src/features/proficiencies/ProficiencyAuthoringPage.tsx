import { useMemo, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import type { GameClient } from "@/hooks/useGameClient";
import { ProficiencyDefinitionList } from "@/features/proficiencies/components/ProficiencyDefinitionList";
import { ProficiencyEditorForm } from "@/features/proficiencies/components/ProficiencyEditorForm";
import {
  buildCreateProficiencySubmission,
  buildDeleteProficiencySubmission,
  buildUpdateProficiencySubmission,
  selectOrderedProficiencyDefinitions
} from "@/features/proficiencies/proficiencyAuthoringRequests";
import {
  createEmptyProficiencyEditorValues,
  toProficiencyEditorValues,
  type ProficiencyEditorValues
} from "@/features/proficiencies/proficiencyEditorValues";
import { Panel } from "@/shared/ui/Panel";

export function ProficiencyAuthoringPage({ client }: { client: GameClient }): JSX.Element {
  const {
    state: {
      serverState: {
        proficiencies: proficiencyRecords,
        proficiencyOrder
      }
    }
  } = useAppStore();

  const [editingProficiencyId, setEditingProficiencyId] = useState<string | null>(null);
  const [values, setValues] = useState<ProficiencyEditorValues>(
    createEmptyProficiencyEditorValues
  );

  const proficiencies = useMemo(
    () => selectOrderedProficiencyDefinitions(proficiencyRecords, proficiencyOrder),
    [proficiencyOrder, proficiencyRecords]
  );

  const startNewProficiency = (): void => {
    setEditingProficiencyId(null);
    setValues(createEmptyProficiencyEditorValues());
  };

  const onSubmit = (): void => {
    const submission = editingProficiencyId
      ? buildUpdateProficiencySubmission(proficiencyRecords[editingProficiencyId], values)
      : buildCreateProficiencySubmission(values);
    if (!submission) {
      return;
    }

    client.sendProtocolRequest(submission.request, submission.label);
    startNewProficiency();
  };

  const deleteProficiency = (proficiencyId: string): void => {
    const submission = buildDeleteProficiencySubmission(
      proficiencyId,
      proficiencyRecords[proficiencyId]
    );
    client.sendProtocolRequest(submission.request, submission.label);
    if (editingProficiencyId === proficiencyId) {
      startNewProficiency();
    }
  };

  return (
    <Panel
      title="Proficiency Authoring"
      actions={
        editingProficiencyId ? (
          <button className="button button--secondary" onClick={startNewProficiency}>
            New Proficiency
          </button>
        ) : null
      }
    >
      <div className="stack">
        <ProficiencyEditorForm
          editingProficiencyId={editingProficiencyId}
          values={values}
          onChange={setValues}
          onSubmit={onSubmit}
          onCancel={startNewProficiency}
        />

        <ProficiencyDefinitionList
          proficiencies={proficiencies}
          onEdit={(proficiency) => {
            setEditingProficiencyId(proficiency.id);
            setValues(toProficiencyEditorValues(proficiency));
          }}
          onDelete={deleteProficiency}
        />
      </div>
    </Panel>
  );
}
