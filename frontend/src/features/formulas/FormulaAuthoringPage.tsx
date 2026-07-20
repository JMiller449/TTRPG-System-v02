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
import { CatalogTileGrid } from "@/shared/ui/CatalogTileGrid";
import { confirmDestructiveAction } from "@/shared/ui/confirmDestructiveAction";
import { makeId } from "@/shared/utils/id";

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

  const formulas = useMemo(
    () => selectOrderedFormulaDefinitions(formulaRecords, formulaOrder),
    [formulaOrder, formulaRecords]
  );

  useEffect(() => {
    if (actionFormulaAuthoringMetadata || requestedMetadataRef.current) {
      return;
    }

    requestedMetadataRef.current = true;
    const submission = buildLoadActionFormulaAuthoringMetadataSubmission();
    client.sendProtocolRequest(submission.request, submission.label);
  }, [actionFormulaAuthoringMetadata, client]);

  const startNewFormula = (): void => {
    setEditingFormulaId(null);
    setValues(createEmptyFormulaEditorValues());
  };

  const onSubmit = (): void => {
    if (!values.formulaText.trim()) {
      return;
    }

    const submission = editingFormulaId
      ? buildUpdateFormulaSubmission(formulaRecords[editingFormulaId], values)
      : buildCreateFormulaSubmission(values, makeId("formula"));
    if (!submission) {
      return;
    }

    client.sendProtocolRequest(submission.request, submission.label);
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
            <button className="button button--secondary" onClick={startNewFormula}>
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
        catalog={
          <CatalogTileGrid
            items={formulas.map((formula) => ({ id: formula.id, name: formula.id }))}
            selectedId={editingFormulaId}
            emptyMessage="No formulas created yet."
            onSelect={(formulaId) => {
              const formula = formulaRecords[formulaId];
              if (!formula) {
                return;
              }
              setEditingFormulaId(formula.id);
              setValues(toFormulaEditorValues(formula));
            }}
          />
        }
      >
        <div className="stack">
          <FormulaEditorForm
            editingFormulaId={editingFormulaId}
            values={values}
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
