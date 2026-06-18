import { useMemo, useState } from "react";
import { useAppStore } from "@/app/state/store";
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
import { Panel } from "@/shared/ui/Panel";
import { makeId } from "@/shared/utils/id";

export function FormulaAuthoringPage({ client }: { client: GameClient }): JSX.Element {
  const {
    state: {
      serverState: { formulas: formulaRecords, formulaOrder }
    }
  } = useAppStore();

  const [editingFormulaId, setEditingFormulaId] = useState<string | null>(null);
  const [values, setValues] = useState<FormulaEditorValues>(createEmptyFormulaEditorValues);

  const formulas = useMemo(
    () => selectOrderedFormulaDefinitions(formulaRecords, formulaOrder),
    [formulaOrder, formulaRecords]
  );

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
    setEditingFormulaId(null);
    setValues(createEmptyFormulaEditorValues());
  };

  const deleteFormula = (formulaId: string): void => {
    const submission = buildDeleteFormulaSubmission(formulaId, formulaRecords[formulaId]);
    client.sendProtocolRequest(submission.request, submission.label);
    if (editingFormulaId === formulaId) {
      setEditingFormulaId(null);
      setValues(createEmptyFormulaEditorValues());
    }
  };

  return (
    <Panel title="Formula Authoring">
      <div className="stack">
        <FormulaEditorForm
          editingFormulaId={editingFormulaId}
          values={values}
          onChange={setValues}
          onSubmit={onSubmit}
          onCancel={() => {
            setEditingFormulaId(null);
            setValues(createEmptyFormulaEditorValues());
          }}
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
