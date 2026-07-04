import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import type { AttributeDefinition } from "@/domain/models";
import { AttributeFormulaVariablePicker } from "@/features/attributes/AttributeFormulaVariablePicker";
import { attributePayloadFromDraft, type AttributeDraft } from "@/features/attributes/attributeEditorValues";
import { appendFormulaToken, upsertFormulaAlias } from "@/features/variables/variablePicker";

type AttributeSubjectType = AttributeDefinition["subject_types"][number];
type AttributeValueType = AttributeDefinition["value_type"];

export function AttributeEditorForm({
  editingId,
  draft,
  metadata,
  pending = false,
  requiredSubjectType,
  onChange,
  onSubmit,
  onCancel
}: {
  editingId: string | null;
  draft: AttributeDraft;
  metadata: ActionFormulaAuthoringMetadata | null;
  pending?: boolean;
  requiredSubjectType?: AttributeSubjectType;
  onChange: (draft: AttributeDraft) => void;
  onSubmit: () => void;
  onCancel?: () => void;
}): JSX.Element {
  const canSubmit = Boolean(attributePayloadFromDraft(draft, editingId ?? "draft-attribute"));

  return (
    <div className="card stack attribute-editor-form">
      <label>
        Name
        <input
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
        />
      </label>
      <label>
        Description
        <textarea
          value={draft.description}
          onChange={(event) => onChange({ ...draft, description: event.target.value })}
        />
      </label>
      <fieldset className="attribute-subject-options">
        <legend>Allowed subjects</legend>
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
            Insert a variable valid for every selected subject, or enter a relative path and
            reference its alias as @name in the formula.
          </p>
          <AttributeFormulaVariablePicker
            metadata={metadata}
            subjectTypes={draft.subjectTypes}
            excludedAttributeId={editingId ?? undefined}
            onPick={(entry) =>
              onChange({
                ...draft,
                defaultText: appendFormulaToken(draft.defaultText, entry.token),
                formulaAliases: upsertFormulaAlias(draft.formulaAliases, entry.alias)
              })
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
      ) : (
        <label>
          Default {draft.valueType === "list" ? "(comma separated)" : "value"}
          <input
            value={draft.defaultText}
            onChange={(event) => onChange({ ...draft, defaultText: event.target.value })}
          />
        </label>
      )}
      {["enum", "list"].includes(draft.valueType) ? (
        <label>
          Allowed values (comma separated)
          <input
            value={draft.validationOptions}
            onChange={(event) => onChange({ ...draft, validationOptions: event.target.value })}
          />
        </label>
      ) : null}
      {draft.valueType === "reference" ? (
        <label>
          Reference kind
          <select
            value={draft.referenceKind}
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
      <div className="inline-actions">
        <button className="button" type="button" onClick={onSubmit} disabled={!canSubmit || pending}>
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
