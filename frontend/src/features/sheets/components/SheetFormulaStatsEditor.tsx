import { useEffect, useMemo, useState } from "react";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import type { Formula, Stats } from "@/domain/models";
import { FormulaTagEditor } from "@/features/formulas/components/FormulaTagEditor";
import { normalizeFormulaTags } from "@/features/formulas/formulaTags";
import {
  FORMULA_STAT_KEYS,
  toSheetRelativeFormulaAlias
} from "@/features/sheets/sheetDefinitionEditing";
import {
  appendFormulaToken,
  buildVariablePickerEntries,
  upsertFormulaAlias
} from "@/features/variables/variablePicker";
import type { SheetFormulaStatName } from "@/infrastructure/ws/requestBuilders";
import { DISPLAY_NAMES } from "@/domain/stats";
import { Field } from "@/shared/ui/Field";

function cloneFormula(formula: Formula): Formula {
  return {
    aliases: formula.aliases?.map((alias) => ({ ...alias, path: [...alias.path] })) ?? null,
    text: formula.text,
    tags: [...(formula.tags ?? [])]
  };
}

export function SheetFormulaStatsEditor({
  stats,
  metadata,
  onSave
}: {
  stats: Stats;
  metadata: ActionFormulaAuthoringMetadata | null;
  onSave: (statName: SheetFormulaStatName, formula: Formula) => void;
}): JSX.Element {
  const [selectedStatName, setSelectedStatName] = useState<SheetFormulaStatName>(
    FORMULA_STAT_KEYS[0]
  );
  const authoritativeFormula = stats[selectedStatName];
  const [draft, setDraft] = useState<Formula>(() => cloneFormula(authoritativeFormula));
  const variableEntries = useMemo(
    () => buildVariablePickerEntries(metadata, "formula").filter((entry) => entry.root === "sheet"),
    [metadata]
  );

  useEffect(() => {
    setDraft(cloneFormula(authoritativeFormula));
  }, [authoritativeFormula, selectedStatName]);

  const removeAlias = (name: string): void => {
    const aliases = (draft.aliases ?? []).filter((alias) => alias.name !== name);
    setDraft({ ...draft, aliases: aliases.length > 0 ? aliases : null });
  };

  return (
    <section className="template-editor stack">
      <p className="template-editor__title">Formula Stats</p>
      <p className="muted">
        Formula aliases are selected from backend sheet metadata and stored as relative sheet paths.
      </p>
      <Field label="Formula Stat">
        <select
          value={selectedStatName}
          onChange={(event) => setSelectedStatName(event.target.value as SheetFormulaStatName)}
        >
          {FORMULA_STAT_KEYS.map((statName) => (
            <option key={statName} value={statName}>
              {DISPLAY_NAMES[statName]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Formula">
        <textarea
          rows={3}
          value={draft.text}
          onChange={(event) => setDraft({ ...draft, text: event.target.value })}
          placeholder="@constitution * 10"
        />
      </Field>
      <Field label="Insert Sheet Variable">
        <select
          value=""
          disabled={variableEntries.length === 0}
          onChange={(event) => {
            const entry = variableEntries.find((candidate) => candidate.key === event.target.value);
            if (!entry) {
              return;
            }
            const alias = toSheetRelativeFormulaAlias(entry);
            if (!alias) {
              return;
            }
            setDraft({
              ...draft,
              text: appendFormulaToken(draft.text, entry.token),
              aliases: upsertFormulaAlias(draft.aliases ?? null, alias)
            });
          }}
        >
          <option value="">
            {variableEntries.length === 0 ? "Metadata unavailable" : "Select a variable"}
          </option>
          {variableEntries.map((entry) => (
            <option key={entry.key} value={entry.key}>
              {entry.label} ({entry.path.join(".")})
            </option>
          ))}
        </select>
      </Field>
      {(draft.aliases ?? []).length > 0 ? (
        <div className="formula-tag-list" aria-label="Formula aliases">
          {draft.aliases?.map((alias) => (
            <button
              className="formula-tag"
              type="button"
              key={alias.name}
              onClick={() => removeAlias(alias.name)}
            >
              @{alias.name}: {alias.path.join(".")} ×
            </button>
          ))}
        </div>
      ) : (
        <p className="muted">No aliases selected.</p>
      )}
      <FormulaTagEditor tags={draft.tags ?? []} onChange={(tags) => setDraft({ ...draft, tags })} />
      <button
        type="button"
        className="button"
        disabled={!draft.text.trim()}
        onClick={() =>
          onSave(selectedStatName, {
            ...draft,
            text: draft.text.trim(),
            tags: normalizeFormulaTags(draft.tags ?? [])
          })
        }
      >
        Save Formula Stat
      </button>
    </section>
  );
}
