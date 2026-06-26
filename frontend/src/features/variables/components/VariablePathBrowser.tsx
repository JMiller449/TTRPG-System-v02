import { useMemo, useState } from "react";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import { EmptyState } from "@/shared/ui/EmptyState";
import {
  buildVariablePickerEntries,
  filterVariablePickerEntries,
  variablePathLabel,
  type VariablePickerEntry,
  type VariablePickerMode
} from "@/features/variables/variablePicker";

export function VariablePathBrowser({
  metadata,
  mode,
  title,
  onPick
}: {
  metadata: ActionFormulaAuthoringMetadata | null;
  mode: VariablePickerMode;
  title?: string;
  onPick: (entry: VariablePickerEntry) => void;
}): JSX.Element {
  const [query, setQuery] = useState("");
  const entries = useMemo(() => buildVariablePickerEntries(metadata, mode), [metadata, mode]);
  const visibleEntries = useMemo(
    () => filterVariablePickerEntries(entries, query),
    [entries, query]
  );

  return (
    <section className="template-editor variable-path-browser">
      <div className="list-item__top">
        <p className="template-editor__title">{title ?? "Variable Browser"}</p>
        <span className="muted">{mode === "formula" ? "Formula references" : "Mutation paths"}</span>
      </div>

      <div className="stack">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search variables, shortcuts, or paths"
        />

        <div className="list variable-path-browser__list">
          {!metadata ? <EmptyState message="Authoring metadata not loaded yet." /> : null}
          {metadata && visibleEntries.length === 0 ? <EmptyState message="No matching variables." /> : null}
          {visibleEntries.map((entry) => (
            <article className="list-item list-item--block variable-path-browser__entry" key={entry.key}>
              <div className="list-item__top">
                <strong>{entry.label}</strong>
                <span className="muted">{entry.token}</span>
              </div>
              <div className="muted">{variablePathLabel(entry)}</div>
              <div className="muted">
                {entry.valueType}
                {entry.shortcuts.length > 0 ? ` · ${entry.shortcuts.join(", ")}` : ""}
              </div>
              {entry.description ? <div className="muted">{entry.description}</div> : null}
              <div className="inline-actions">
                <button className="button button--secondary" onClick={() => onPick(entry)}>
                  Insert
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
