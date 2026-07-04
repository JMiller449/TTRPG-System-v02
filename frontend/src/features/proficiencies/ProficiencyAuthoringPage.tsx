import { useMemo, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import type { GameClient } from "@/hooks/useGameClient";
import { ProficiencyEditorForm } from "@/features/proficiencies/components/ProficiencyEditorForm";
import {
  buildCreateProficiencySubmission,
  buildDeleteProficiencySubmission,
  buildUpdateProficiencySubmission,
  selectOrderedProficiencyDefinitions
} from "@/features/proficiencies/proficiencyAuthoringRequests";
import {
  createEmptyProficiencyEditorValues,
  deriveProficiencyId,
  toProficiencyEditorValues,
  type ProficiencyEditorValues
} from "@/features/proficiencies/proficiencyEditorValues";
import { Panel } from "@/shared/ui/Panel";
import { CatalogEditorLayout } from "@/shared/ui/CatalogEditorLayout";
import { CatalogTileGrid } from "@/shared/ui/CatalogTileGrid";

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
      : buildCreateProficiencySubmission(
          values,
          deriveProficiencyId(values.name, Object.keys(proficiencyRecords))
        );
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
      subtitle="Trainable skills — weapon families, magic schools, and anything else that improves with use."
      actions={
        editingProficiencyId ? (
          <div className="inline-actions">
            <button className="button button--secondary" onClick={startNewProficiency}>
              New Proficiency
            </button>
            <button
              className="button button--danger"
              onClick={() => deleteProficiency(editingProficiencyId)}
            >
              Delete Proficiency
            </button>
          </div>
        ) : null
      }
    >
      <CatalogEditorLayout
        catalogLabel="Proficiency Catalog"
        catalog={
          <CatalogTileGrid
            items={proficiencies.map((proficiency) => ({
              id: proficiency.id,
              name: proficiency.name
            }))}
            selectedId={editingProficiencyId}
            emptyMessage="No proficiencies created yet."
            onSelect={(proficiencyId) => {
              const proficiency = proficiencyRecords[proficiencyId];
              if (!proficiency) {
                return;
              }
              setEditingProficiencyId(proficiency.id);
              setValues(toProficiencyEditorValues(proficiency));
            }}
          />
        }
      >
        <ProficiencyEditorForm
          editingProficiencyId={editingProficiencyId}
          values={values}
          onChange={setValues}
          onSubmit={onSubmit}
          onCancel={startNewProficiency}
        />
      </CatalogEditorLayout>
    </Panel>
  );
}
