import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import type { FactDefinition, FactValue } from "@/domain/models";
import { buildLoadActionFormulaAuthoringMetadataSubmission } from "@/features/actions/actionAuthoringRequests";
import { FactFormulaVariablePicker } from "@/features/facts/FactFormulaVariablePicker";
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
import { appendFormulaToken, upsertFormulaAlias } from "@/features/variables/variablePicker";

type FactValueType = FactDefinition["value_type"];

function factValueText(value: FactValue): string {
  if (value.type === "formula") {
    return value.formula.text;
  }
  if (Array.isArray(value.value)) {
    return value.value.join(", ");
  }
  return String(value.value);
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
        <div className="card stack">
          <label>
            Name
            <input
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </label>
          <label>
            Description
            <textarea
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
          </label>
          <fieldset>
            <legend>Allowed subjects</legend>
            {(["sheet", "item", "action"] as const).map((subjectType) => (
              <label key={subjectType}>
                <input
                  type="checkbox"
                  checked={draft.subjectTypes.includes(subjectType)}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      subjectTypes: event.target.checked
                        ? [...draft.subjectTypes, subjectType]
                        : draft.subjectTypes.filter((entry) => entry !== subjectType)
                    })
                  }
                />
                {subjectType}
              </label>
            ))}
          </fieldset>
          <label>
            Value type
            <select
              value={draft.valueType}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  valueType: event.target.value as FactValueType,
                  defaultText: ""
                })
              }
            >
              {(["number", "boolean", "text", "enum", "reference", "list"] as const).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          {draft.valueType === "number" ? (
            <label>
              Number source
              <select
                value={draft.numberMode}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    numberMode: event.target.value as FactDraft["numberMode"]
                  })
                }
              >
                <option value="literal">Literal</option>
                <option value="formula">Formula</option>
              </select>
            </label>
          ) : null}
          {draft.valueType === "number" && draft.numberMode === "formula" ? (
            <fieldset className="stack">
              <legend>Formula aliases</legend>
              <p className="muted">
                Insert a variable valid for every selected subject, or enter a relative path and
                reference its alias as @name in the formula.
              </p>
              <FactFormulaVariablePicker
                metadata={actionFormulaAuthoringMetadata}
                subjectTypes={draft.subjectTypes}
                excludedFactId={editingId ?? undefined}
                onPick={(entry) =>
                  setDraft((current) => ({
                    ...current,
                    defaultText: appendFormulaToken(current.defaultText, entry.token),
                    formulaAliases: upsertFormulaAlias(current.formulaAliases, entry.alias)
                  }))
                }
              />
              {draft.formulaAliases.map((alias, index) => (
                <div className="inline-actions" key={`${index}-${alias.name}`}>
                  <label>
                    Alias
                    <input
                      value={alias.name}
                      onChange={(event) => {
                        const formulaAliases = [...draft.formulaAliases];
                        formulaAliases[index] = { ...alias, name: event.target.value };
                        setDraft({ ...draft, formulaAliases });
                      }}
                    />
                  </label>
                  <label>
                    Relative path
                    <input
                      value={alias.path.join(".")}
                      onChange={(event) => {
                        const formulaAliases = [...draft.formulaAliases];
                        formulaAliases[index] = {
                          ...alias,
                          path: event.target.value
                            .split(".")
                            .map((entry) => entry.trim())
                            .filter(Boolean)
                        };
                        setDraft({ ...draft, formulaAliases });
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="danger"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        formulaAliases: draft.formulaAliases.filter(
                          (_, aliasIndex) => aliasIndex !== index
                        )
                      })
                    }
                  >
                    Remove Alias
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setDraft({
                    ...draft,
                    formulaAliases: [...draft.formulaAliases, { name: "", path: [] }]
                  })
                }
              >
                Add Alias
              </button>
            </fieldset>
          ) : null}
          {draft.valueType === "boolean" ? (
            <label>
              Default
              <select
                value={draft.defaultText}
                onChange={(event) => setDraft({ ...draft, defaultText: event.target.value })}
              >
                <option value="false">False</option>
                <option value="true">True</option>
              </select>
            </label>
          ) : (
            <label>
              Default {draft.valueType === "list" ? "(comma separated)" : "value"}
              <input
                value={draft.defaultText}
                onChange={(event) => setDraft({ ...draft, defaultText: event.target.value })}
              />
            </label>
          )}
          {["enum", "list"].includes(draft.valueType) ? (
            <label>
              Allowed values (comma separated)
              <input
                value={draft.validationOptions}
                onChange={(event) => setDraft({ ...draft, validationOptions: event.target.value })}
              />
            </label>
          ) : null}
          {draft.valueType === "reference" ? (
            <label>
              Reference kind
              <select
                value={draft.referenceKind}
                onChange={(event) => setDraft({ ...draft, referenceKind: event.target.value })}
              >
                <option value="">Select a reference kind</option>
                <option value="proficiency">Proficiency</option>
                <option value="item">Item</option>
                <option value="action">Action</option>
                <option value="sheet">Sheet</option>
              </select>
            </label>
          ) : null}
          <label>
            Unit
            <input
              value={draft.unit}
              onChange={(event) => setDraft({ ...draft, unit: event.target.value })}
            />
          </label>
          <label>
            Visibility
            <select
              value={draft.visibility}
              onChange={(event) =>
                setDraft({ ...draft, visibility: event.target.value as FactDraft["visibility"] })
              }
            >
              <option value="public">Public</option>
              <option value="gm_only">GM only</option>
            </select>
          </label>
          <div className="inline-actions">
            <button type="button" onClick={submit}>
              {editingId ? "Save Fact" : "Create Fact"}
            </button>
            {editingId ? (
              <button type="button" className="secondary" onClick={reset}>
                Cancel
              </button>
            ) : null}
          </div>
        </div>

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
                    setDraft({
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
                    });
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
