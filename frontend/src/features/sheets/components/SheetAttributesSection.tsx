import { useEffect, useState } from "react";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import type {
  AttributeBridge,
  AttributeDefinition,
  AttributeValue,
  Formula
} from "@/domain/models";
import { AttributeFormulaVariablePicker } from "@/features/attributes/AttributeFormulaVariablePicker";
import { appendFormulaToken, upsertFormulaAlias } from "@/features/variables/variablePicker";

function displayAttributeValue(value: AttributeBridge["evaluated_value"]): string {
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

function displayedBridgeValue(bridge: AttributeBridge): AttributeBridge["evaluated_value"] {
  if (bridge.evaluated_value !== null && bridge.evaluated_value !== undefined) {
    return bridge.evaluated_value;
  }
  if (!bridge.evaluation_error && bridge.value.type !== "formula") {
    return bridge.value.value;
  }
  return bridge.evaluated_value;
}

export function SheetAttributesSection({
  definitions,
  bridges,
  canEdit,
  compact = false,
  pageLayout = false,
  draftMode = false,
  onSaveFormula,
  onSaveValue,
  onReset,
  onAttach,
  onDetach,
  validationOptionLabels,
  formulaMetadata,
  subjectType = "sheet"
}: {
  definitions: Record<string, AttributeDefinition>;
  bridges: Record<string, AttributeBridge>;
  canEdit: boolean;
  compact?: boolean;
  pageLayout?: boolean;
  draftMode?: boolean;
  onSaveFormula: (attributeId: string, formula: Formula) => void;
  onSaveValue?: (attributeId: string, value: AttributeValue) => void;
  onReset: (attributeId: string) => void;
  onAttach?: (attributeId: string) => void;
  onDetach?: (attributeId: string) => void;
  validationOptionLabels?: Record<string, Record<string, string>>;
  formulaMetadata?: ActionFormulaAuthoringMetadata | null;
  subjectType?: "sheet" | "item" | "action";
}): JSX.Element {
  const [selectedAttributeId, setSelectedAttributeId] = useState("");
  const orderedBridges = Object.values(bridges).sort((left, right) => {
    const leftName = definitions[left.attribute_id]?.name ?? left.attribute_id;
    const rightName = definitions[right.attribute_id]?.name ?? right.attribute_id;
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
    return <p className="muted">No Attributes are attached to this {subjectType}.</p>;
  }

  return (
    <section
      className={`stack sheet-attributes ${compact ? "sheet-attributes--compact" : ""} ${pageLayout ? "sheet-attributes--page" : ""}`}
      aria-label={pageLayout ? "Attribute values" : undefined}
      aria-labelledby={pageLayout ? undefined : "sheet-attributes-title"}
    >
      {!pageLayout ? (
        <div>
          <h4 id="sheet-attributes-title">{compact ? "Derived" : "Attributes"}</h4>
          {!compact ? (
            <p className="muted">Backend-evaluated named values for this {subjectType}.</p>
          ) : null}
        </div>
      ) : null}
      {canEdit && onAttach && availableDefinitions.length > 0 ? (
        <div className="inline-actions">
          <label>
            Add optional Attribute
            <select
              value={selectedAttributeId}
              onChange={(event) => setSelectedAttributeId(event.target.value)}
            >
              <option value="">Select an Attribute</option>
              {availableDefinitions.map((definition) => (
                <option key={definition.id} value={definition.id}>
                  {definition.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button"
            type="button"
            disabled={!selectedAttributeId}
            onClick={() => {
              onAttach(selectedAttributeId);
              setSelectedAttributeId("");
            }}
          >
            Attach Attribute
          </button>
        </div>
      ) : null}
      {orderedBridges.map((bridge) => (
        <SheetAttributeCard
          key={bridge.relationship_id}
          definition={definitions[bridge.attribute_id]}
          bridge={bridge}
          canEdit={canEdit}
          compact={compact}
          draftMode={draftMode}
          onSaveFormula={onSaveFormula}
          onSaveValue={onSaveValue}
          onReset={onReset}
          onDetach={onDetach}
          validationOptionLabels={validationOptionLabels}
          formulaMetadata={formulaMetadata}
          subjectType={subjectType}
        />
      ))}
    </section>
  );
}

function SheetAttributeCard({
  definition,
  bridge,
  canEdit,
  compact,
  draftMode,
  onSaveFormula,
  onSaveValue,
  onReset,
  onDetach,
  validationOptionLabels,
  formulaMetadata,
  subjectType
}: {
  definition: AttributeDefinition | undefined;
  bridge: AttributeBridge;
  canEdit: boolean;
  compact: boolean;
  draftMode: boolean;
  onSaveFormula: (attributeId: string, formula: Formula) => void;
  onSaveValue?: (attributeId: string, value: AttributeValue) => void;
  onReset: (attributeId: string) => void;
  onDetach?: (attributeId: string) => void;
  validationOptionLabels?: Record<string, Record<string, string>>;
  formulaMetadata?: ActionFormulaAuthoringMetadata | null;
  subjectType: "sheet" | "item" | "action";
}): JSX.Element {
  const formula = bridge.value.type === "formula" ? bridge.value.formula : null;
  const [formulaText, setFormulaText] = useState(formula?.text ?? "");
  const [formulaAliases, setFormulaAliases] = useState(formula?.aliases ?? null);
  const [literalText, setLiteralText] = useState(
    bridge.value.type === "formula" ? "" : attributeValueText(bridge.value)
  );

  useEffect(() => {
    setFormulaText(formula?.text ?? "");
    setFormulaAliases(
      formula?.aliases?.map((alias) => ({ ...alias, path: [...alias.path] })) ?? null
    );
  }, [formula]);

  useEffect(() => {
    if (bridge.value.type !== "formula") {
      setLiteralText(attributeValueText(bridge.value));
    }
  }, [bridge.value]);

  const name = definition?.name ?? bridge.attribute_id;
  const unit = definition?.unit ? ` ${definition.unit}` : "";
  const displayedValue = displayedBridgeValue(bridge);
  const validationOptions = definition?.validation_options ?? [];
  const shouldUseOptionSelect =
    bridge.value.type !== "list" &&
    (validationOptions.length > 0 ||
      (bridge.value.type === "reference" && Boolean(definition?.reference_kind)));
  const optionSelectValue =
    shouldUseOptionSelect && validationOptions.includes(literalText) ? literalText : "";
  const canSaveLiteralValue =
    !shouldUseOptionSelect || (Boolean(literalText) && validationOptions.includes(literalText));
  const validationOptionLabelMap = definition ? validationOptionLabels?.[definition.id] : undefined;
  const missingReferenceId =
    definition?.reference_kind &&
    bridge.value.type === "reference" &&
    literalText &&
    !validationOptions.includes(literalText)
      ? literalText
      : null;

  const commitLiteralText = (text: string): void => {
    setLiteralText(text);
    if (!draftMode || !onSaveValue || bridge.value.type === "formula") {
      return;
    }
    const value = literalAttributeValue(bridge.value, text);
    if (value) {
      onSaveValue(bridge.attribute_id, value);
    }
  };

  return (
    <article
      className={`card stack sheet-attribute-card ${compact ? "sheet-attribute-card--compact" : ""}`}
    >
      <div className="inline-actions">
        <strong>{name}</strong>
        {definition?.required && !compact ? <span className="badge">Required</span> : null}
      </div>
      <div>
        {!compact ? <span className="muted">Value: </span> : null}
        <strong>
          {displayAttributeValue(displayedValue)}
          {displayedValue === null || displayedValue === undefined ? "" : unit}
        </strong>
      </div>
      {definition?.description && !compact ? (
        <p className="muted">{definition.description}</p>
      ) : null}
      {bridge.evaluation_error ? (
        <p role="alert" className="form-error">
          {bridge.evaluation_error}
        </p>
      ) : null}
      {canEdit && formula ? (
        <div className="stack">
          <AttributeFormulaVariablePicker
            metadata={formulaMetadata ?? null}
            subjectTypes={[subjectType]}
            excludedAttributeId={bridge.attribute_id}
            onPick={(entry) => {
              const nextText = appendFormulaToken(formulaText, entry.token);
              const nextAliases = upsertFormulaAlias(formulaAliases, entry.alias);
              setFormulaText(nextText);
              setFormulaAliases(nextAliases);
              if (draftMode) {
                onSaveFormula(bridge.attribute_id, {
                  ...formula,
                  aliases: nextAliases,
                  text: nextText
                });
              }
            }}
          />
          <label>
            Formula
            <input
              value={formulaText}
              onChange={(event) => {
                const text = event.target.value;
                setFormulaText(text);
                if (draftMode) {
                  onSaveFormula(bridge.attribute_id, {
                    ...formula,
                    aliases: formulaAliases,
                    text
                  });
                }
              }}
            />
          </label>
          <div className="inline-actions">
            {!draftMode ? (
              <button
                type="button"
                disabled={!formulaText.trim() || formulaText === formula.text}
                onClick={() =>
                  onSaveFormula(bridge.attribute_id, {
                    ...formula,
                    aliases: formulaAliases,
                    text: formulaText.trim()
                  })
                }
              >
                Save Formula
              </button>
            ) : null}
            <button
              type="button"
              className="secondary"
              onClick={() => onReset(bridge.attribute_id)}
            >
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
                  onChange={(event) => commitLiteralText(event.target.value)}
                >
                  <option value="false">False</option>
                  <option value="true">True</option>
                </select>
              ) : shouldUseOptionSelect ? (
                <select
                  value={optionSelectValue}
                  onChange={(event) => commitLiteralText(event.target.value)}
                  disabled={validationOptions.length === 0}
                >
                  <option value="">
                    {validationOptions.length === 0 ? "No options available" : "Select a value"}
                  </option>
                  {validationOptions.map((option) => (
                    <option key={option} value={option}>
                      {validationOptionLabelMap?.[option] ?? option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={literalText}
                  onChange={(event) => commitLiteralText(event.target.value)}
                />
              )}
            </label>
            {!draftMode ? (
              <button
                type="button"
                disabled={!canSaveLiteralValue}
                onClick={() => {
                  const current = bridge.value;
                  if (current.type === "formula") {
                    return;
                  }
                  const value = literalAttributeValue(current, literalText);
                  if (value) {
                    onSaveValue(bridge.attribute_id, value);
                  }
                }}
              >
                Save Value
              </button>
            ) : null}
            <button
              type="button"
              className="secondary"
              onClick={() => onReset(bridge.attribute_id)}
            >
              Reset to Default
            </button>
          </div>
          {missingReferenceId ? (
            <p className="error-text" role="alert">
              Missing {definition?.reference_kind} reference: {missingReferenceId}. Select a valid
              replacement{definition?.required ? "" : " or clear this field"}.
            </p>
          ) : null}
          {bridge.value.type === "list" && definition?.validation_options?.length ? (
            <p className="muted">Allowed values: {definition.validation_options.join(", ")}</p>
          ) : null}
        </div>
      ) : null}
      {canEdit && !definition?.required && onDetach ? (
        <button type="button" className="danger" onClick={() => onDetach(bridge.attribute_id)}>
          Detach Attribute
        </button>
      ) : null}
    </article>
  );
}

function attributeValueText(value: Exclude<AttributeValue, { type: "formula" }>): string {
  return Array.isArray(value.value) ? value.value.join(", ") : String(value.value);
}

function literalAttributeValue(
  current: Exclude<AttributeValue, { type: "formula" }>,
  text: string
): AttributeValue | null {
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
