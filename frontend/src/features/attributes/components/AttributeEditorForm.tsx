import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import type { AttributeDefinition } from "@/domain/models";
import {
  buildAttributeFormulaVariableEntries,
  toAttributeFormulaVariableOptions
} from "@/features/attributes/attributeFormulaVariables";
import {
  attributePayloadFromDraft,
  type AttributeDraft
} from "@/features/attributes/attributeEditorValues";
import { FormulaVariableInput } from "@/features/variables/components/FormulaVariableInput";
import { upsertFormulaAlias } from "@/features/variables/variablePicker";
import { Field } from "@/shared/ui/Field";
import { FormValidationSummary } from "@/shared/ui/FormValidationSummary";

type AttributeSubjectType = AttributeDefinition["subject_types"][number];
type AttributeValueType = AttributeDefinition["value_type"];

export function AttributeEditorForm({
  editingId,
  draft,
  metadata,
  pending = false,
  validationAttempted = false,
  requiredSubjectType,
  onChange,
  onSubmit,
  onCancel
}: {
  editingId: string | null;
  draft: AttributeDraft;
  metadata: ActionFormulaAuthoringMetadata | null;
  pending?: boolean;
  validationAttempted?: boolean;
  requiredSubjectType?: AttributeSubjectType;
  onChange: (draft: AttributeDraft) => void;
  onSubmit: () => void;
  onCancel?: () => void;
}): JSX.Element {
  const canSubmit = Boolean(attributePayloadFromDraft(draft, editingId ?? "draft-attribute"));
  const nameMissing = !draft.name.trim();
  const subjectsMissing = draft.subjectTypes.length === 0;
  const defaultInvalid =
    draft.valueType === "number" &&
    (draft.numberMode === "formula"
      ? !draft.defaultText.trim()
      : !Number.isFinite(Number(draft.defaultText)));
  const optionsMissing =
    ["enum", "list"].includes(draft.valueType) && !draft.validationOptions.trim();
  const referenceMissing = draft.valueType === "reference" && !draft.referenceKind.trim();

  return (
    <div className="stack attribute-editor-form">
      <div>
        <p className="template-editor__title">
          {editingId ? "Edit Attribute" : "Create Attribute"}
        </p>
        <p className="muted">
          Name it, choose what kind of value it holds, and pick where it can be attached.
        </p>
      </div>
      <Field label="Name" required invalid={validationAttempted && nameMissing}>
        <input
          value={draft.name}
          required
          aria-invalid={validationAttempted && nameMissing}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          placeholder="e.g. Range"
        />
      </Field>
      <label>
        Description
        <textarea
          value={draft.description}
          onChange={(event) => onChange({ ...draft, description: event.target.value })}
          placeholder="What this Attribute means at the table"
        />
      </label>
      <fieldset
        className={`attribute-subject-options${validationAttempted && subjectsMissing ? " fieldset--invalid" : ""}`}
        aria-invalid={validationAttempted && subjectsMissing}
      >
        <legend>
          Can be attached to
          <span className="field__required-marker" aria-hidden="true">
            *
          </span>
          <span className="r6-sr-only"> (required)</span>
        </legend>
        {(["sheet", "item", "action"] as const).map((subjectType) => {
          const required = requiredSubjectType === subjectType;
          return (
            <label className="attribute-subject-option" key={subjectType}>
              <input
                type="checkbox"
                checked={draft.subjectTypes.includes(subjectType)}
                disabled={required}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    subjectTypes: event.target.checked
                      ? [...draft.subjectTypes, subjectType]
                      : draft.subjectTypes.filter((entry) => entry !== subjectType)
                  })
                }
              />
              <span>
                {subjectType}
                {required ? " (required here)" : ""}
              </span>
            </label>
          );
        })}
      </fieldset>
      <label>
        Value type
        <select
          value={draft.valueType}
          onChange={(event) =>
            onChange({
              ...draft,
              valueType: event.target.value as AttributeValueType,
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
              onChange({
                ...draft,
                numberMode: event.target.value as AttributeDraft["numberMode"]
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
            Type @ in the formula to search variables valid for every selected subject, or enter a
            relative path and reference its alias as @name.
          </p>
          {draft.formulaAliases.map((alias, index) => (
            <div className="inline-actions" key={`${index}-${alias.name}`}>
              <label>
                Alias
                <input
                  value={alias.name}
                  onChange={(event) => {
                    const formulaAliases = [...draft.formulaAliases];
                    formulaAliases[index] = { ...alias, name: event.target.value };
                    onChange({ ...draft, formulaAliases });
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
                    onChange({ ...draft, formulaAliases });
                  }}
                />
              </label>
              <button
                type="button"
                className="button button--danger"
                onClick={() =>
                  onChange({
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
            className="button button--secondary"
            onClick={() =>
              onChange({
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
            onChange={(event) => onChange({ ...draft, defaultText: event.target.value })}
          >
            <option value="false">False</option>
            <option value="true">True</option>
          </select>
        </label>
      ) : draft.valueType === "number" && draft.numberMode === "formula" ? (
        <FormulaVariableInput
          label="Default formula"
          value={draft.defaultText}
          options={toAttributeFormulaVariableOptions(
            buildAttributeFormulaVariableEntries(metadata, draft.subjectTypes).filter(
              (entry) => entry.path.join(".") !== `attributes.${editingId ?? ""}`
            )
          )}
          loading={!metadata}
          required
          ariaInvalid={validationAttempted && defaultInvalid}
          onChange={(defaultText) => onChange({ ...draft, defaultText })}
          onVariableSelect={(entry, defaultText) =>
            onChange({
              ...draft,
              defaultText,
              formulaAliases: upsertFormulaAlias(draft.formulaAliases, entry.alias)
            })
          }
          placeholder="Type @ to insert a variable"
        />
      ) : (
        <label className={validationAttempted && defaultInvalid ? "field--invalid" : undefined}>
          Default {draft.valueType === "list" ? "(comma separated)" : "value"}
          <input
            value={draft.defaultText}
            aria-invalid={validationAttempted && defaultInvalid}
            onChange={(event) => onChange({ ...draft, defaultText: event.target.value })}
          />
        </label>
      )}
      {["enum", "list"].includes(draft.valueType) ? (
        <label className={validationAttempted && optionsMissing ? "field--invalid" : undefined}>
          Allowed values (comma separated)
          <span className="field__required-marker" aria-hidden="true">
            *
          </span>
          <span className="r6-sr-only"> (required)</span>
          <input
            value={draft.validationOptions}
            required
            aria-invalid={validationAttempted && optionsMissing}
            onChange={(event) => onChange({ ...draft, validationOptions: event.target.value })}
          />
        </label>
      ) : null}
      {draft.valueType === "reference" ? (
        <label className={validationAttempted && referenceMissing ? "field--invalid" : undefined}>
          Reference kind
          <span className="field__required-marker" aria-hidden="true">
            *
          </span>
          <span className="r6-sr-only"> (required)</span>
          <select
            value={draft.referenceKind}
            required
            aria-invalid={validationAttempted && referenceMissing}
            onChange={(event) => onChange({ ...draft, referenceKind: event.target.value })}
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
          onChange={(event) => onChange({ ...draft, unit: event.target.value })}
        />
      </label>
      <label>
        Visibility
        <select
          value={draft.visibility}
          onChange={(event) =>
            onChange({
              ...draft,
              visibility: event.target.value as AttributeDraft["visibility"]
            })
          }
        >
          <option value="public">Public</option>
          <option value="gm_only">GM only</option>
        </select>
      </label>
      <FormValidationSummary
        visible={validationAttempted && !canSubmit}
        message={
          nameMissing ||
          subjectsMissing ||
          (draft.numberMode === "formula" && defaultInvalid) ||
          optionsMissing ||
          referenceMissing
            ? "Complete all required fields."
            : defaultInvalid
              ? "Enter a valid numeric default."
              : "Review the indicated fields."
        }
      />
      <div className="inline-actions">
        <button className="button" type="button" onClick={onSubmit} disabled={pending}>
          {pending ? "Creating…" : editingId ? "Save Attribute" : "Create Attribute"}
        </button>
        {onCancel ? (
          <button
            type="button"
            className="button button--secondary"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}
