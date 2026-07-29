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
import { CatalogBrowser } from "@/features/catalogs/CatalogBrowser";
import { useCatalogCreationTarget } from "@/features/catalogs/useCatalogCreationTarget";
import { confirmDestructiveAction } from "@/shared/ui/confirmDestructiveAction";

export function ProficiencyAuthoringPage({ client }: { client: GameClient }): JSX.Element {
  const {
    state: {
      serverState: { proficiencies: proficiencyRecords, proficiencyOrder }
    }
  } = useAppStore();

  const [editingProficiencyId, setEditingProficiencyId] = useState<string | null>(null);
  const [values, setValues] = useState<ProficiencyEditorValues>(createEmptyProficiencyEditorValues);

  const proficiencies = useMemo(
    () => selectOrderedProficiencyDefinitions(proficiencyRecords, proficiencyOrder),
    [proficiencyOrder, proficiencyRecords]
  );
  const { beginCreation, queueCreatedEntry } = useCatalogCreationTarget({
    catalog: "proficiencies",
    client,
    entries: proficiencyRecords
  });

  const startNewProficiency = (folderId: string | null = null): void => {
    beginCreation(folderId);
    setEditingProficiencyId(null);
    setValues(createEmptyProficiencyEditorValues());
  };

  const onSubmit = (): void => {
    const proficiencyId =
      editingProficiencyId ?? deriveProficiencyId(values.name, Object.keys(proficiencyRecords));
    const submission = editingProficiencyId
      ? buildUpdateProficiencySubmission(proficiencyRecords[editingProficiencyId], values)
      : buildCreateProficiencySubmission(values, proficiencyId);
    if (!submission) {
      return;
    }

    client.sendProtocolRequest(submission.request, submission.label);
    if (!editingProficiencyId) {
      queueCreatedEntry(proficiencyId);
    }
    startNewProficiency();
  };

  const deleteProficiency = (proficiencyId: string): void => {
    const proficiency = proficiencyRecords[proficiencyId];
    if (
      !confirmDestructiveAction({
        action: "Delete",
        subject: proficiency?.name ?? proficiencyId,
        consequence:
          "This permanently deletes the proficiency definition. Existing dependency checks still apply."
      })
    ) {
      return;
    }
    const submission = buildDeleteProficiencySubmission(proficiencyId, proficiency);
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
            <button className="button button--secondary" onClick={() => startNewProficiency()}>
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
          <CatalogBrowser
            catalog="proficiencies"
            client={client}
            items={proficiencies.map((proficiency) => ({
              id: proficiency.id,
              name: proficiency.name
            }))}
            selectedId={editingProficiencyId}
            entityLabel="proficiency"
            emptyMessage="No proficiencies created yet."
            onCreateEntry={startNewProficiency}
            onSelect={(proficiencyId) => {
              const proficiency = proficiencyRecords[proficiencyId];
              if (!proficiency) {
                return;
              }
              beginCreation(null);
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
