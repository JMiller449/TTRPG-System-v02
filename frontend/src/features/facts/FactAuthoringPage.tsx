import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import type { FactDefinition, FactValue } from "@/domain/models";
import { buildLoadActionFormulaAuthoringMetadataSubmission } from "@/features/actions/actionAuthoringRequests";
import { FactEditorForm } from "@/features/facts/components/FactEditorForm";
import {
  emptyFactDraft,
  factPayloadFromDraft,
  type FactDraft
} from "@/features/facts/factEditorValues";
import type { GameClient } from "@/hooks/useGameClient";
import {
  buildCreateFactRequest,
  buildDeleteFactRequest,
  buildUpdateFactRequest
} from "@/infrastructure/ws/requestBuilders";
import { Panel } from "@/shared/ui/Panel";
import { makeId } from "@/shared/utils/id";

function factValueText(value: FactValue): string {
  if (value.type === "formula") {
    return value.formula.text;
  }
  if (Array.isArray(value.value)) {
    return value.value.join(", ");
  }
  return String(value.value);
}

function draftFromFact(fact: FactDefinition): FactDraft {
  return {
    name: fact.name,
    description: fact.description ?? "",
    subjectTypes: fact.subject_types,
    valueType: fact.value_type,
    numberMode: fact.default_value.type === "formula" ? "formula" : "literal",
    formulaAliases:
      fact.default_value.type === "formula"
        ? (fact.default_value.formula.aliases ?? []).map((alias) => ({
            ...alias,
            path: [...alias.path]
          }))
        : [],
    defaultText: factValueText(fact.default_value),
    unit: fact.unit ?? "",
    visibility: fact.visibility ?? "public",
    validationOptions: (fact.validation_options ?? []).join(", "),
    referenceKind: fact.reference_kind ?? ""
  };
}

export function FactAuthoringPage({ client }: { client: GameClient }): JSX.Element {
  const { state } = useAppStore();
  const { facts, factOrder } = state.serverState;
  const { actionFormulaAuthoringMetadata } = state.uiState;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<FactDraft>(emptyFactDraft);
  const requestedMetadataRef = useRef(false);
  const orderedFacts = useMemo(
    () => factOrder.map((id) => facts[id]).filter((fact): fact is FactDefinition => Boolean(fact)),
    [factOrder, facts]
  );

  useEffect(() => {
    if (actionFormulaAuthoringMetadata || requestedMetadataRef.current) {
      return;
    }
    requestedMetadataRef.current = true;
    const submission = buildLoadActionFormulaAuthoringMetadataSubmission();
    client.sendProtocolRequest(submission.request, submission.label);
  }, [actionFormulaAuthoringMetadata, client]);

  const reset = (): void => {
    setEditingId(null);
    setDraft(emptyFactDraft());
  };

  const submit = (): void => {
    const id = editingId ?? makeId("fact");
    const fact = factPayloadFromDraft(draft, id);
    if (!fact) {
      return;
    }
    client.sendProtocolRequest(
      editingId
        ? buildUpdateFactRequest({ factId: editingId, fact })
        : buildCreateFactRequest({ fact }),
      editingId ? `Update Fact: ${fact.name}` : `Create Fact: ${fact.name}`
    );
    reset();
  };

  return (
    <Panel title="Fact Builder">
      <div className="stack">
        <FactEditorForm
          editingId={editingId}
          draft={draft}
          metadata={actionFormulaAuthoringMetadata}
          onChange={setDraft}
          onSubmit={submit}
          onCancel={editingId ? reset : undefined}
        />

        {orderedFacts.map((fact) => (
          <article key={fact.id} className="card stack">
            <div className="inline-actions">
              <strong>{fact.name}</strong>
              {fact.required ? <span className="badge">Required</span> : null}
              {fact.backend_owned && !fact.required ? <span className="badge">Preset</span> : null}
            </div>
            <p className="muted">
              {fact.subject_types.join(", ")} · {fact.value_type} · default{" "}
              {factValueText(fact.default_value)}
            </p>
            {fact.description ? <p>{fact.description}</p> : null}
            {!fact.backend_owned ? (
              <div className="inline-actions">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(fact.id);
                    setDraft(draftFromFact(fact));
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() =>
                    client.sendProtocolRequest(
                      buildDeleteFactRequest({ factId: fact.id }),
                      `Delete Fact: ${fact.name}`
                    )
                  }
                >
                  Delete
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </Panel>
  );
}
