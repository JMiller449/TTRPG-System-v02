import { useState } from "react";
import {
  addFormulaTags,
  COMMON_FORMULA_TAGS,
  normalizeFormulaTags,
  removeFormulaTag
} from "@/features/formulas/formulaTags";
import { Field } from "@/shared/ui/Field";

export function FormulaTagEditor({
  tags,
  onChange,
  label = "Formula Tags",
  suggestions = COMMON_FORMULA_TAGS
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  label?: string;
  suggestions?: string[];
}): JSX.Element {
  const [draft, setDraft] = useState("");
  const normalizedTags = normalizeFormulaTags(tags);

  const addDraft = (): void => {
    const nextTags = addFormulaTags(normalizedTags, draft);
    if (
      nextTags.length !== normalizedTags.length ||
      !nextTags.every((tag, index) => tag === normalizedTags[index])
    ) {
      onChange(nextTags);
    }
    setDraft("");
  };

  const toggleSuggestion = (tag: string): void => {
    onChange(
      normalizedTags.includes(tag)
        ? removeFormulaTag(normalizedTags, tag)
        : addFormulaTags(normalizedTags, tag)
    );
  };

  return (
    <div className="formula-tag-editor stack">
      <Field label={label}>
        <div className="formula-tag-editor__input-row">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addDraft();
              }
            }}
            placeholder="damage, fire, custom tag"
            aria-label={`${label} custom tags`}
          />
          <button className="button button--secondary" type="button" onClick={addDraft}>
            Add Tags
          </button>
        </div>
      </Field>

      {normalizedTags.length > 0 ? (
        <div className="formula-tag-list" aria-label={`Selected ${label.toLowerCase()}`}>
          {normalizedTags.map((tag) => (
            <button
              className="formula-tag"
              type="button"
              key={tag}
              onClick={() => onChange(removeFormulaTag(normalizedTags, tag))}
              aria-label={`Remove formula tag ${tag}`}
            >
              {tag} ×
            </button>
          ))}
        </div>
      ) : (
        <p className="muted formula-tag-editor__empty">No tags selected.</p>
      )}

      <div>
        <p className="muted formula-tag-editor__suggestion-label">Common tags</p>
        <div className="formula-tag-suggestions">
          {normalizeFormulaTags(suggestions).map((tag) => {
            const selected = normalizedTags.includes(tag);
            return (
              <button
                className={`formula-tag-suggestion ${selected ? "formula-tag-suggestion--selected" : ""}`}
                type="button"
                key={tag}
                aria-pressed={selected}
                onClick={() => toggleSuggestion(tag)}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
