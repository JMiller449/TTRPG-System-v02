import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import type { GameClient } from "@/hooks/useGameClient";
import { FormulaEditorForm } from "@/features/formulas/components/FormulaEditorForm";
import {
  createEmptyFormulaEditorValues,
  toFormulaEditorValues,
  type FormulaEditorValues
} from "@/features/formulas/formulaEditorValues";
import {
  buildCreateFormulaSubmission,
  buildDeleteFormulaSubmission,
  buildUpdateFormulaSubmission,
  selectOrderedFormulaDefinitions
} from "@/features/formulas/formulaAuthoringRequests";
import { buildLoadActionFormulaAuthoringMetadataSubmission } from "@/features/actions/actionAuthoringRequests";
import { Panel } from "@/shared/ui/Panel";
import { CatalogEditorLayout } from "@/shared/ui/CatalogEditorLayout";
import { CatalogBrowser } from "@/features/catalogs/CatalogBrowser";
import { useCatalogCreationTarget } from "@/features/catalogs/useCatalogCreationTarget";
import { confirmDestructiveAction } from "@/shared/ui/confirmDestructiveAction";
import { makeId } from "@/shared/utils/id";
import { useFormValidationAttempt } from "@/shared/ui/useFormValidationAttempt";

export function FormulaAuthoringPage({ client }: { client: GameClient }): JSX.Element {
  const {
    state: {
      serverState: { formulas: formulaRecords, formulaOrder },
      uiState: { actionFormulaAuthoringMetadata }
    }
  } = useAppStore();
  const requestedMetadataRef = useRef(false);

  const [editingFormulaId, setEditingFormulaId] = useState<string | null>(null);
  const [values, setValues] = useState<FormulaEditorValues>(createEmptyFormulaEditorValues);
  const validation = useFormValidationAttempt();

  const formulas = useMemo(
    () => selectOrderedFormulaDefinitions(formulaRecords, formulaOrder),
    [formulaOrder, formulaRecords]
  );
  const { beginCreation, queueCreatedEntry } = useCatalogCreationTarget({
    catalog: "formulas",
    client,
    entries: formulaRecords
  });

  useEffect(() => {
    if (actionFormulaAuthoringMetadata || requestedMetadataRef.current) {
      return;
    }

    requestedMetadataRef.current = true;
    const submission = buildLoadActionFormulaAuthoringMetadataSubmission();
    client.sendProtocolRequest(submission.request, submission.label);
  }, [actionFormulaAuthoringMetadata, client]);

  const startNewFormula = (folderId: string | null = null): void => {
    validation.reset();
    beginCreation(folderId);
    setEditingFormulaId(null);
    setValues(createEmptyFormulaEditorValues());
  };

  const onSubmit = (): void => {
    if (!validation.validate(Boolean(values.formulaText.trim()))) {
      return;
    }

    const formulaId = editingFormulaId ?? makeId("formula");
    const submission = editingFormulaId
      ? buildUpdateFormulaSubmission(formulaRecords[editingFormulaId], values)
      : buildCreateFormulaSubmission(values, formulaId);
    if (!submission) {
      return;
    }

    client.sendProtocolRequest(submission.request, submission.label);
    if (!editingFormulaId) {
      queueCreatedEntry(formulaId);
    }
    startNewFormula();
  };

  const deleteFormula = (formulaId: string): void => {
    if (
      !confirmDestructiveAction({
        action: "Delete",
        subject: formulaId,
        consequence:
          "This permanently deletes the formula definition. Existing dependency checks still apply."
      })
    ) {
      return;
    }
    const submission = buildDeleteFormulaSubmission(formulaId, formulaRecords[formulaId]);
    client.sendProtocolRequest(submission.request, submission.label);
    if (editingFormulaId === formulaId) {
      startNewFormula();
    }
  };

  return (
    <Panel
      title="Formula Authoring"
      subtitle="Reusable dice formulas that actions can share. Tags control which modifiers are allowed to change them."
      actions={
        editingFormulaId ? (
          <div className="inline-actions">
            <button className="button button--secondary" onClick={() => startNewFormula()}>
              New Formula
            </button>
            <button
              className="button button--danger"
              onClick={() => deleteFormula(editingFormulaId)}
            >
              Delete Formula
            </button>
          </div>
        ) : null
      }
    >
      <CatalogEditorLayout
        catalogLabel="Formula Catalog"
        editorClassName="authoring-workspace__editor--vertical"
        catalog={
          <CatalogBrowser
            catalog="formulas"
            client={client}
            items={formulas.map((formula) => ({ id: formula.id, name: formula.id }))}
            selectedId={editingFormulaId}
            entityLabel="formula"
            emptyMessage="No formulas created yet."
            onCreateEntry={startNewFormula}
            onSelect={(formulaId) => {
              const formula = formulaRecords[formulaId];
              if (!formula) {
                return;
              }
              beginCreation(null);
              setEditingFormulaId(formula.id);
              setValues(toFormulaEditorValues(formula));
              validation.reset();
            }}
          />
        }
      >
        <div className="stack">
          <FormulaEditorForm
            editingFormulaId={editingFormulaId}
            values={values}
            validationAttempted={validation.attempted}
            onChange={setValues}
            onSubmit={onSubmit}
            onCancel={startNewFormula}
            metadata={actionFormulaAuthoringMetadata}
          />
        </div>
      </CatalogEditorLayout>
    </Panel>
  );
}
