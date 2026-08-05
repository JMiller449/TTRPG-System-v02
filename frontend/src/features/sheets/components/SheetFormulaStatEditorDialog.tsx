import { useCallback, useEffect, useState } from "react";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import type { Formula } from "@/domain/models";
import { DISPLAY_NAMES } from "@/domain/stats";
import { FormulaTagEditor } from "@/features/formulas/components/FormulaTagEditor";
import { normalizeFormulaTags } from "@/features/formulas/formulaTags";
import {
  toSheetRelativeFormulaAlias,
  type SheetFormulaStatName
} from "@/features/sheets/sheetDefinitionEditing";
import { FormulaVariableInput } from "@/features/variables/components/FormulaVariableInput";
import {
  formulaVariableSearchOptions,
  upsertFormulaAlias
} from "@/features/variables/variablePicker";
import { ModalDialog } from "@/shared/ui/ModalDialog";

function cloneFormula(formula: Formula): Formula {
  return {
    aliases: formula.aliases?.map((alias) => ({ ...alias, path: [...alias.path] })) ?? null,
    text: formula.text,
    tags: [...(formula.tags ?? [])]
  };
}

export function SheetFormulaStatEditorDialog({
  statName,
  formula,
  metadata,
  onSave,
  onClose
}: {
  statName: SheetFormulaStatName;
  formula: Formula;
  metadata: ActionFormulaAuthoringMetadata | null;
  onSave: (statName: SheetFormulaStatName, formula: Formula) => void;
  onClose: () => void;
}): JSX.Element {
  const [draft, setDraft] = useState<Formula>(() => cloneFormula(formula));

  useEffect(() => {
    setDraft(cloneFormula(formula));
  }, [formula, statName]);

  const removeAlias = (name: string): void => {
    const aliases = (draft.aliases ?? []).filter((alias) => alias.name !== name);
    setDraft({ ...draft, aliases: aliases.length > 0 ? aliases : null });
  };
  const closeEditor = useCallback(onClose, [onClose]);

  return (
    <ModalDialog
      title={`Edit ${DISPLAY_NAMES[statName]}`}
      description="Edit this derived stat's backend-authoritative formula. Type @ to insert an allowed sheet variable."
      onClose={closeEditor}
    >
      <div className="sheet-formula-stat-editor stack">
        <FormulaVariableInput
          label="Formula"
          rows={3}
          value={draft.text}
          options={formulaVariableSearchOptions(metadata, "sheet")}
          loading={!metadata}
          onChange={(text) => setDraft({ ...draft, text })}
          onVariableSelect={(entry, text) => {
            const alias = toSheetRelativeFormulaAlias(entry);
            if (!alias) {
              return;
            }
            setDraft({
              ...draft,
              text,
              aliases: upsertFormulaAlias(draft.aliases ?? null, alias)
            });
          }}
          placeholder="Type @ to insert a sheet variable"
        />
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
        <FormulaTagEditor
          tags={draft.tags ?? []}
          onChange={(tags) => setDraft({ ...draft, tags })}
        />
        <div className="inline-actions">
          <button
            type="button"
            className="button"
            disabled={!draft.text.trim()}
            onClick={() =>
              onSave(statName, {
                ...draft,
                text: draft.text.trim(),
                tags: normalizeFormulaTags(draft.tags ?? [])
              })
            }
          >
            Save Formula
          </button>
          <button type="button" className="button button--secondary" onClick={closeEditor}>
            Cancel
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}
