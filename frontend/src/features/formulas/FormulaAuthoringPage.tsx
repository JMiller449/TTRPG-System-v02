import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import type { GameClient } from "@/hooks/useGameClient";
import { FormulaDefinitionList } from "@/features/formulas/components/FormulaDefinitionList";
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
import { VariablePathBrowser } from "@/features/variables/components/VariablePathBrowser";
import {
  appendFormulaToken,
  upsertFormulaAlias,
  type VariablePickerEntry
} from "@/features/variables/variablePicker";
import { Panel } from "@/shared/ui/Panel";
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

  const insertVariable = (entry: VariablePickerEntry): void => {
    setValues((currentValues) => ({
      ...currentValues,
      formulaText: appendFormulaToken(currentValues.formulaText, entry.token),
      aliases: upsertFormulaAlias(currentValues.aliases, entry.alias)
    }));
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
    const submission = buildDeleteFormulaSubmission(formulaId, formulaRecords[formulaId]);
    client.sendProtocolRequest(submission.request, submission.label);
    if (editingFormulaId === formulaId) {
      startNewFormula();
    }
  };

  return (
    <Panel
      title="Formula Authoring"
      actions={
        editingFormulaId ? (
          <button className="button button--secondary" onClick={startNewFormula}>
            New Formula
          </button>
        ) : null
      }
    >
      <div className="stack">
        <FormulaEditorForm
          editingFormulaId={editingFormulaId}
          values={values}
          onChange={setValues}
          onSubmit={onSubmit}
          onCancel={startNewFormula}
        />

        <VariablePathBrowser
          metadata={actionFormulaAuthoringMetadata}
          mode="formula"
          title="Formula Variable Browser"
          onPick={insertVariable}
        />

        <FormulaDefinitionList
          formulas={formulas}
          onEdit={(formula) => {
            setEditingFormulaId(formula.id);
            setValues(toFormulaEditorValues(formula));
          }}
          onDelete={deleteFormula}
        />
      </div>
    </Panel>
  );
}
