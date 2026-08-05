import { useEffect, useState } from "react";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import type {
  AttributeBridge,
  AttributeDefinition,
  AttributeValue,
  Formula
} from "@/domain/models";
import {
  buildAttributeFormulaVariableEntries,
  toAttributeFormulaVariableOptions
} from "@/features/attributes/attributeFormulaVariables";
import { FormulaVariableInput } from "@/features/variables/components/FormulaVariableInput";
import { confirmDestructiveAction } from "@/shared/ui/confirmDestructiveAction";
import { upsertFormulaAlias } from "@/features/variables/variablePicker";
import { CatalogEntityPicker } from "@/features/catalogs/CatalogEntityPicker";
import { ModalDialog } from "@/shared/ui/ModalDialog";

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
  compactCards = false,
  pageLayout = false,
  draftMode = false,
  onSaveFormula,
  onSaveValue,
  onReset,
  onAttach,
  onCreateNew,
  onDetach,
  validationOptionLabels,
  formulaMetadata,
  subjectType = "sheet"
}: {
  definitions: Record<string, AttributeDefinition>;
  bridges: Record<string, AttributeBridge>;
  canEdit: boolean;
  compact?: boolean;
  compactCards?: boolean;
  pageLayout?: boolean;
  draftMode?: boolean;
  onSaveFormula: (attributeId: string, formula: Formula) => void;
  onSaveValue?: (attributeId: string, value: AttributeValue) => void;
  onReset: (attributeId: string) => void;
  onAttach?: (attributeId: string) => void;
  onCreateNew?: () => void;
  onDetach?: (attributeId: string) => void;
  validationOptionLabels?: Record<string, Record<string, string>>;
  formulaMetadata?: ActionFormulaAuthoringMetadata | null;
  subjectType?: "sheet" | "item" | "action";
}): JSX.Element {
  const [selectedAttributeId, setSelectedAttributeId] = useState("");
  const [attachDialogOpen, setAttachDialogOpen] = useState(false);
  const [editingAttributeId, setEditingAttributeId] = useState<string | null>(null);
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

  const editingBridge = editingAttributeId ? bridges[editingAttributeId] : undefined;
  const useCompactCardLayout = pageLayout || compactCards;

  useEffect(() => {
    if (editingAttributeId && !editingBridge) {
      setEditingAttributeId(null);
    }
  }, [editingAttributeId, editingBridge]);

  if (
    orderedBridges.length === 0 &&
    (!canEdit || (!onCreateNew && (!onAttach || availableDefinitions.length === 0)))
  ) {
    return <p className="muted">No Attributes are attached to this {subjectType}.</p>;
  }

  return (
    <section
      className={`stack sheet-attributes ${compact ? "sheet-attributes--compact" : ""} ${useCompactCardLayout ? "sheet-attributes--page" : ""}`}
      aria-label={useCompactCardLayout ? "Attribute values" : undefined}
      aria-labelledby={useCompactCardLayout ? undefined : "sheet-attributes-title"}
    >
      {!useCompactCardLayout ? (
        <div>
          <h4 id="sheet-attributes-title">{compact ? "Derived" : "Attributes"}</h4>
          {!compact ? (
            <p className="muted">Backend-evaluated named values for this {subjectType}.</p>
          ) : null}
        </div>
      ) : null}
      {useCompactCardLayout && canEdit && (onAttach || onCreateNew) ? (
        <div className="sheet-attributes__toolbar">
          <span className="muted">{orderedBridges.length} attached</span>
          <div className="inline-actions">
            {onAttach ? (
              <button
                className="button button--secondary"
                type="button"
                disabled={availableDefinitions.length === 0}
                onClick={() => setAttachDialogOpen(true)}
              >
                Add Existing
              </button>
            ) : null}
            {onCreateNew ? (
              <button className="button" type="button" onClick={onCreateNew}>
                Create Attribute
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {!useCompactCardLayout && canEdit && onAttach && availableDefinitions.length > 0 ? (
        <div className="inline-actions sheet-attributes__attach">
          <CatalogEntityPicker
            catalog="attributes"
            label="Add optional Attribute"
            placeholder="Search Attribute catalog"
            selectedId={selectedAttributeId}
            options={availableDefinitions.map((definition) => ({
              id: definition.id,
              label: definition.name,
              secondary: definition.description,
              keywords: [definition.id],
              value: definition.id
            }))}
            emptyMessage="No optional Attributes available."
            onSelect={setSelectedAttributeId}
          />
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
      {useCompactCardLayout ? (
        <div className="sheet-attributes__grid">
          {orderedBridges.map((bridge) => (
            <SheetAttributeSummaryCard
              key={bridge.relationship_id}
              definition={definitions[bridge.attribute_id]}
              bridge={bridge}
              canEdit={canEdit}
              draftMode={draftMode}
              onEdit={() => setEditingAttributeId(bridge.attribute_id)}
            />
          ))}
          {orderedBridges.length === 0 ? (
            <p className="muted sheet-attributes__empty">No Attributes are attached yet.</p>
          ) : null}
        </div>
      ) : (
        orderedBridges.map((bridge) => (
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
        ))
      )}
      {useCompactCardLayout && attachDialogOpen && onAttach ? (
        <ModalDialog
          title="Add Existing Attribute"
          description={`Choose an optional Attribute to attach to this ${subjectType}.`}
          onClose={() => {
            setAttachDialogOpen(false);
            setSelectedAttributeId("");
          }}
        >
          <div className="stack sheet-attribute-picker-dialog">
            <CatalogEntityPicker
              catalog="attributes"
              label="Attribute"
              placeholder="Search Attribute catalog"
              selectedId={selectedAttributeId}
              options={availableDefinitions.map((definition) => ({
                id: definition.id,
                label: definition.name,
                secondary: definition.description,
                keywords: [definition.id],
                value: definition.id
              }))}
              emptyMessage="No optional Attributes available."
              onSelect={setSelectedAttributeId}
            />
            <div className="inline-actions">
              <button
                className="button"
                type="button"
                disabled={!selectedAttributeId}
                onClick={() => {
                  onAttach(selectedAttributeId);
                  setSelectedAttributeId("");
                  setAttachDialogOpen(false);
                }}
              >
                Add Attribute
              </button>
              <button
                className="button button--secondary"
                type="button"
                onClick={() => {
                  setSelectedAttributeId("");
                  setAttachDialogOpen(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </ModalDialog>
      ) : null}
      {useCompactCardLayout && editingBridge ? (
        <ModalDialog
          title={`Edit ${definitions[editingBridge.attribute_id]?.name ?? editingBridge.attribute_id}`}
          description={`Update this ${draftMode ? `${subjectType} draft` : subjectType === "sheet" ? "character" : subjectType}'s Attribute value or restore its default.`}
          onClose={() => setEditingAttributeId(null)}
        >
          <SheetAttributeCard
            definition={definitions[editingBridge.attribute_id]}
            bridge={editingBridge}
            canEdit={canEdit}
            compact={false}
            draftMode={draftMode}
            onSaveFormula={onSaveFormula}
            onSaveValue={onSaveValue}
            onReset={onReset}
            onDetach={onDetach}
            validationOptionLabels={validationOptionLabels}
            formulaMetadata={formulaMetadata}
            subjectType={subjectType}
            dialogMode
          />
        </ModalDialog>
      ) : null}
    </section>
  );
}

function SheetAttributeSummaryCard({
  definition,
  bridge,
  canEdit,
  draftMode,
  onEdit
}: {
  definition: AttributeDefinition | undefined;
  bridge: AttributeBridge;
  canEdit: boolean;
  draftMode: boolean;
  onEdit: () => void;
}): JSX.Element {
  const name = definition?.name ?? bridge.attribute_id;
  const displayedValue = displayedBridgeValue(bridge);
  const unit = definition?.unit ? ` ${definition.unit}` : "";
  const formula = bridge.value.type === "formula" ? bridge.value.formula : null;
  const displayedSummaryValue =
    draftMode && formula && (displayedValue === null || displayedValue === undefined)
      ? "Formula"
      : displayAttributeValue(displayedValue);
  const tooltipId = `attribute-formula-tooltip-${bridge.relationship_id}`;
  const aliases = formula?.aliases ?? [];
  const aliasSummary =
    aliases.length > 0
      ? aliases.map((alias) => `@${alias.name} → ${alias.path.join(".")}`).join(", ")
      : "No aliases configured";
  const content = (
    <>
      <span className="sheet-attribute-summary__heading">
        <strong>{name}</strong>
        {definition?.required ? <span className="badge">Required</span> : null}
      </span>
      <span className="sheet-attribute-summary__value">
        {displayedSummaryValue}
        {displayedValue === null || displayedValue === undefined ? "" : unit}
      </span>
      {definition?.description ? (
        <span className="muted sheet-attribute-summary__description">{definition.description}</span>
      ) : null}
      {bridge.evaluation_error ? (
        <span className="form-error sheet-attribute-summary__error">Formula error</span>
      ) : null}
      {formula ? (
        <span className="formula-stat-tooltip" id={tooltipId} role="tooltip">
          <span>
            Formula: <code>{formula.text}</code>
          </span>
          <span>{aliasSummary}</span>
          {bridge.evaluation_error ? <span>{bridge.evaluation_error}</span> : null}
        </span>
      ) : null}
    </>
  );
  const className = `card sheet-attribute-summary${formula ? " sheet-attribute-summary--formula" : ""}`;

  return canEdit ? (
    <button
      className={className}
      type="button"
      aria-label={`Edit ${name}. Current value ${displayedSummaryValue}${unit}.`}
      aria-describedby={formula ? tooltipId : undefined}
      onClick={onEdit}
    >
      {content}
    </button>
  ) : (
    <article
      className={className}
      tabIndex={formula ? 0 : undefined}
      aria-describedby={formula ? tooltipId : undefined}
    >
      {content}
    </article>
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
  subjectType,
  dialogMode = false
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
  dialogMode?: boolean;
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
  const selectedListOptions =
    bridge.value.type === "list"
      ? literalText
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean)
      : [];
  const shouldUseListOptionSelect = bridge.value.type === "list" && validationOptions.length > 0;
  const shouldUseOptionSelect =
    bridge.value.type !== "list" &&
    (validationOptions.length > 0 ||
      (bridge.value.type === "reference" && Boolean(definition?.reference_kind)));
  const optionSelectValue =
    shouldUseOptionSelect && validationOptions.includes(literalText) ? literalText : "";
  const canSaveLiteralValue =
    (!shouldUseOptionSelect || (Boolean(literalText) && validationOptions.includes(literalText))) &&
    (!shouldUseListOptionSelect ||
      (selectedListOptions.length > 0 &&
        selectedListOptions.every((option) => validationOptions.includes(option))));
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

  const commitListOptions = (options: string[]): void => {
    commitLiteralText(options.join(", "));
  };

  return (
    <article
      className={`card stack sheet-attribute-card ${compact ? "sheet-attribute-card--compact" : ""} ${dialogMode ? "sheet-attribute-card--dialog" : ""}`}
    >
      {!dialogMode ? (
        <div className="inline-actions">
          <strong>{name}</strong>
          {definition?.required && !compact ? <span className="badge">Required</span> : null}
        </div>
      ) : definition?.required ? (
        <span className="badge sheet-attribute-card__required">Required Attribute</span>
      ) : null}
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
        <div className="stack sheet-attribute-card__editor">
          <FormulaVariableInput
            label="Formula"
            value={formulaText}
            multiline={false}
            options={toAttributeFormulaVariableOptions(
              buildAttributeFormulaVariableEntries(formulaMetadata ?? null, [subjectType]).filter(
                (entry) => entry.path.join(".") !== `attributes.${bridge.attribute_id}`
              )
            )}
            loading={!formulaMetadata}
            onChange={(text) => {
              setFormulaText(text);
              if (draftMode) {
                onSaveFormula(bridge.attribute_id, {
                  ...formula,
                  aliases: formulaAliases,
                  text
                });
              }
            }}
            onVariableSelect={(entry, nextText) => {
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
            placeholder="Type @ to insert a variable"
          />
          <div className="inline-actions sheet-attribute-card__actions">
            {!draftMode ? (
              <button
                type="button"
                className="button"
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
              className="button button--secondary"
              onClick={() => onReset(bridge.attribute_id)}
            >
              Reset to Default
            </button>
          </div>
        </div>
      ) : null}
      {canEdit && bridge.value.type !== "formula" && onSaveValue ? (
        <div className="stack sheet-attribute-card__editor">
          <div className="inline-actions sheet-attribute-card__value-editor">
            {definition?.reference_kind === "proficiency" && shouldUseOptionSelect ? (
              <CatalogEntityPicker
                catalog="proficiencies"
                label="Value"
                placeholder="Search proficiency catalog"
                selectedId={optionSelectValue}
                options={validationOptions.map((option) => ({
                  id: option,
                  label: validationOptionLabelMap?.[option] ?? option,
                  keywords: [option],
                  value: option
                }))}
                emptyMessage="No proficiencies available."
                onSelect={commitLiteralText}
              />
            ) : (
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
                ) : shouldUseListOptionSelect ? (
                  <span className="stack">
                    <select
                      aria-label={`${name} option`}
                      value=""
                      onChange={(event) => {
                        const option = event.target.value;
                        if (option && !selectedListOptions.includes(option)) {
                          commitListOptions([...selectedListOptions, option]);
                        }
                      }}
                    >
                      <option value="">Add a value</option>
                      {validationOptions.map((option) => (
                        <option
                          key={option}
                          value={option}
                          disabled={selectedListOptions.includes(option)}
                        >
                          {validationOptionLabelMap?.[option] ?? option}
                        </option>
                      ))}
                    </select>
                    {selectedListOptions.length > 0 ? (
                      <span className="inline-actions">
                        {selectedListOptions.map((option) => (
                          <button
                            key={option}
                            type="button"
                            className="button button--secondary"
                            aria-label={`Remove ${validationOptionLabelMap?.[option] ?? option}`}
                            onClick={() =>
                              commitListOptions(
                                selectedListOptions.filter((selected) => selected !== option)
                              )
                            }
                          >
                            {validationOptionLabelMap?.[option] ?? option} ×
                          </button>
                        ))}
                      </span>
                    ) : (
                      <span className="muted">No values selected</span>
                    )}
                  </span>
                ) : (
                  <input
                    value={literalText}
                    onChange={(event) => commitLiteralText(event.target.value)}
                  />
                )}
              </label>
            )}
            {!draftMode ? (
              <button
                type="button"
                className="button"
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
              className="button button--secondary"
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
        </div>
      ) : null}
      {canEdit && !definition?.required && onDetach ? (
        <button
          type="button"
          className="button button--danger sheet-attribute-card__detach"
          onClick={() => {
            if (
              !confirmDestructiveAction({
                action: "Detach",
                subject: definition?.name ?? bridge.attribute_id,
                consequence: draftMode
                  ? "This removes the Attribute from the draft when you save it."
                  : "This immediately removes the Attribute and its authored value from this subject."
              })
            ) {
              return;
            }
            onDetach(bridge.attribute_id);
          }}
        >
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
