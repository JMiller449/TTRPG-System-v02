import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import type { FactDefinition, FactValue } from "@/domain/models";
import { SheetFactsSection } from "@/features/sheets/components/SheetFactsSection";
import type { TemplateEditorValues } from "@/features/sheets/templateEditorTypes";
import { makeId } from "@/shared/utils/id";

export function TemplateFactsSection({
  values,
  definitions,
  metadata,
  onChange
}: {
  values: TemplateEditorValues;
  definitions: Record<string, FactDefinition>;
  metadata: ActionFormulaAuthoringMetadata | null;
  onChange: (next: TemplateEditorValues) => void;
}): JSX.Element {
  const updateBridge = (factId: string, value: FactValue): void => {
    const bridge = values.facts[factId];
    if (!bridge) {
      return;
    }
    onChange({
      ...values,
      facts: {
        ...values.facts,
        [factId]: {
          ...bridge,
          value,
          evaluated_value: null,
          evaluation_error: null
        }
      }
    });
  };

  return (
    <section className="card stack">
      <div>
        <h3>Facts</h3>
        <p className="muted">
          Required and optional named values saved atomically with this template.
        </p>
      </div>
      <SheetFactsSection
        definitions={definitions}
        bridges={values.facts}
        canEdit
        subjectType="sheet"
        formulaMetadata={metadata}
        onSaveFormula={(factId, formula) => updateBridge(factId, { type: "formula", formula })}
        onSaveValue={updateBridge}
        onReset={(factId) => {
          const definition = definitions[factId];
          if (definition) {
            updateBridge(factId, structuredClone(definition.default_value));
          }
        }}
        onAttach={(factId) => {
          const definition = definitions[factId];
          if (!definition) {
            return;
          }
          onChange({
            ...values,
            facts: {
              ...values.facts,
              [factId]: {
                relationship_id: makeId("sheet_fact"),
                fact_id: factId,
                value: structuredClone(definition.default_value),
                evaluated_value: null,
                evaluation_error: null
              }
            }
          });
        }}
        onDetach={(factId) => {
          const facts = { ...values.facts };
          delete facts[factId];
          onChange({ ...values, facts });
        }}
      />
    </section>
  );
}
