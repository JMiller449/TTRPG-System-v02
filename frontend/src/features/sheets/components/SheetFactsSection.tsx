import { useEffect, useState } from "react";
import type { FactBridge, FactDefinition, FactValue, Formula } from "@/domain/models";

function displayFactValue(value: FactBridge["evaluated_value"]): string {
  if (value === null || value === undefined) {
    return "Unavailable";
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return String(value);
}

function displayedBridgeValue(bridge: FactBridge): FactBridge["evaluated_value"] {
  if (bridge.evaluated_value !== null && bridge.evaluated_value !== undefined) {
    return bridge.evaluated_value;
  }
  if (!bridge.evaluation_error && bridge.value.type !== "formula") {
    return bridge.value.value;
  }
  return bridge.evaluated_value;
}

export function SheetFactsSection({
  definitions,
  bridges,
  canEdit,
  onSaveFormula,
  onSaveValue,
  onReset,
  onAttach,
  onDetach,
  validationOptionLabels,
  subjectType = "sheet"
}: {
  definitions: Record<string, FactDefinition>;
  bridges: Record<string, FactBridge>;
  canEdit: boolean;
  onSaveFormula: (factId: string, formula: Formula) => void;
  onSaveValue?: (factId: string, value: FactValue) => void;
  onReset: (factId: string) => void;
  onAttach?: (factId: string) => void;
  onDetach?: (factId: string) => void;
  validationOptionLabels?: Record<string, Record<string, string>>;
  subjectType?: "sheet" | "item" | "action";
}): JSX.Element {
  const [selectedFactId, setSelectedFactId] = useState("");
  const orderedBridges = Object.values(bridges).sort((left, right) => {
    const leftName = definitions[left.fact_id]?.name ?? left.fact_id;
    const rightName = definitions[right.fact_id]?.name ?? right.fact_id;
    return leftName.localeCompare(rightName);
  });
  const availableDefinitions = Object.values(definitions)
    .filter(
      (definition) =>
        definition.subject_types.includes(subjectType) &&
        !definition.required &&
        !bridges[definition.id]
    )
    .sort((left, right) => left.name.localeCompare(right.name));

  if (orderedBridges.length === 0 && (!canEdit || availableDefinitions.length === 0)) {
    return <p className="muted">No Facts are attached to this {subjectType}.</p>;
  }

  return (
    <section className="stack" aria-labelledby="sheet-facts-title">
      <div>
        <h4 id="sheet-facts-title">Facts</h4>
        <p className="muted">Backend-evaluated named values for this {subjectType}.</p>
      </div>
      {canEdit && onAttach && availableDefinitions.length > 0 ? (
        <div className="inline-actions">
          <label>
            Add optional Fact
            <select
              value={selectedFactId}
              onChange={(event) => setSelectedFactId(event.target.value)}
            >
              <option value="">Select a Fact</option>
              {availableDefinitions.map((definition) => (
                <option key={definition.id} value={definition.id}>
                  {definition.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!selectedFactId}
            onClick={() => {
              onAttach(selectedFactId);
              setSelectedFactId("");
            }}
          >
            Attach Fact
          </button>
        </div>
      ) : null}
      {orderedBridges.map((bridge) => (
        <SheetFactCard
          key={bridge.relationship_id}
          definition={definitions[bridge.fact_id]}
          bridge={bridge}
          canEdit={canEdit}
          onSaveFormula={onSaveFormula}
          onSaveValue={onSaveValue}
          onReset={onReset}
          onDetach={onDetach}
          validationOptionLabels={validationOptionLabels}
        />
      ))}
    </section>
  );
}

function SheetFactCard({
  definition,
  bridge,
  canEdit,
  onSaveFormula,
  onSaveValue,
  onReset,
  onDetach,
  validationOptionLabels
}: {
  definition: FactDefinition | undefined;
  bridge: FactBridge;
  canEdit: boolean;
  onSaveFormula: (factId: string, formula: Formula) => void;
  onSaveValue?: (factId: string, value: FactValue) => void;
  onReset: (factId: string) => void;
  onDetach?: (factId: string) => void;
  validationOptionLabels?: Record<string, Record<string, string>>;
}): JSX.Element {
  const formula = bridge.value.type === "formula" ? bridge.value.formula : null;
  const [formulaText, setFormulaText] = useState(formula?.text ?? "");
  const [literalText, setLiteralText] = useState(
    bridge.value.type === "formula" ? "" : factValueText(bridge.value)
  );

  useEffect(() => {
    setFormulaText(formula?.text ?? "");
  }, [formula?.text]);

  useEffect(() => {
    if (bridge.value.type !== "formula") {
      setLiteralText(factValueText(bridge.value));
    }
  }, [bridge.value]);

  const name = definition?.name ?? bridge.fact_id;
  const unit = definition?.unit ? ` ${definition.unit}` : "";
  const displayedValue = displayedBridgeValue(bridge);

  return (
    <article className="card stack">
      <div className="inline-actions">
        <strong>{name}</strong>
        {definition?.required ? <span className="badge">Required</span> : null}
      </div>
      <div>
        <span className="muted">Value: </span>
        <strong>
          {displayFactValue(displayedValue)}
          {displayedValue === null || displayedValue === undefined ? "" : unit}
        </strong>
      </div>
      {definition?.description ? <p className="muted">{definition.description}</p> : null}
      {bridge.evaluation_error ? (
        <p role="alert" className="form-error">
          {bridge.evaluation_error}
        </p>
      ) : null}
      {canEdit && formula ? (
        <div className="stack">
          <label>
            Formula
            <input value={formulaText} onChange={(event) => setFormulaText(event.target.value)} />
          </label>
          <div className="inline-actions">
            <button
              type="button"
              disabled={!formulaText.trim() || formulaText === formula.text}
              onClick={() =>
                onSaveFormula(bridge.fact_id, {
                  ...formula,
                  text: formulaText.trim()
                })
              }
            >
              Save Formula
            </button>
            <button type="button" className="secondary" onClick={() => onReset(bridge.fact_id)}>
              Reset to Default
            </button>
          </div>
        </div>
      ) : null}
      {canEdit && bridge.value.type !== "formula" && onSaveValue ? (
        <div className="stack">
          <div className="inline-actions">
            <label>
              Value
              {bridge.value.type === "boolean" ? (
                <select
                  value={literalText}
                  onChange={(event) => setLiteralText(event.target.value)}
                >
                  <option value="false">False</option>
                  <option value="true">True</option>
                </select>
              ) : definition?.validation_options?.length && bridge.value.type !== "list" ? (
                <select
                  value={literalText}
                  onChange={(event) => setLiteralText(event.target.value)}
                >
                  {definition.validation_options.map((option) => (
                    <option key={option} value={option}>
                      {validationOptionLabels?.[definition.id]?.[option] ?? option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={literalText}
                  onChange={(event) => setLiteralText(event.target.value)}
                />
              )}
            </label>
            <button
              type="button"
              onClick={() => {
                const current = bridge.value;
                if (current.type === "formula") {
                  return;
                }
                const value = literalFactValue(current, literalText);
                if (value) {
                  onSaveValue(bridge.fact_id, value);
                }
              }}
            >
              Save Value
            </button>
            <button type="button" className="secondary" onClick={() => onReset(bridge.fact_id)}>
              Reset to Default
            </button>
          </div>
          {bridge.value.type === "list" && definition?.validation_options?.length ? (
            <p className="muted">Allowed values: {definition.validation_options.join(", ")}</p>
          ) : null}
        </div>
      ) : null}
      {canEdit && !definition?.required && onDetach ? (
        <button type="button" className="danger" onClick={() => onDetach(bridge.fact_id)}>
          Detach Fact
        </button>
      ) : null}
    </article>
  );
}

function factValueText(value: Exclude<FactValue, { type: "formula" }>): string {
  return Array.isArray(value.value) ? value.value.join(", ") : String(value.value);
}

function literalFactValue(
  current: Exclude<FactValue, { type: "formula" }>,
  text: string
): FactValue | null {
  if (current.type === "number") {
    const value = Number(text);
    return Number.isFinite(value) ? { type: "number", value } : null;
  }
  if (current.type === "boolean") {
    return { type: "boolean", value: text.trim().toLowerCase() === "true" };
  }
  if (current.type === "list") {
    return {
      type: "list",
      value: text
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    };
  }
  return { type: current.type, value: text.trim() };
}
