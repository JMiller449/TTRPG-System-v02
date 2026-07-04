import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import type { FactDefinition, FactValue } from "@/domain/models";
import { SheetFactsSection } from "@/features/sheets/components/SheetFactsSection";
import type { TemplateEditorValues } from "@/features/sheets/templateEditorTypes";
import { makeId } from "@/shared/utils/id";
import type { TemplateContextualEntityKind } from "@/features/sheets/templateContextualAuthoring";

export function TemplateFactsSection({
  values,
  definitions,
  metadata,
  onCreateNew,
  onChange
}: {
  values: TemplateEditorValues;
  definitions: Record<string, FactDefinition>;
  metadata: ActionFormulaAuthoringMetadata | null;
  onCreateNew?: (kind: TemplateContextualEntityKind) => void;
  onChange: (next: TemplateEditorValues) => void;
}): JSX.Element {
  const displayBridges = {
    ...Object.fromEntries(
      Object.values(definitions)
        .filter(
          (definition) =>
            definition.required &&
            definition.subject_types.includes("sheet") &&
            !values.facts[definition.id]
        )
        .map((definition) => [
          definition.id,
          {
            relationship_id: `required_fact_${definition.id}`,
            fact_id: definition.id,
            value: structuredClone(definition.default_value),
            evaluated_value: null,
            evaluation_error: null
          }
        ])
    ),
    ...values.facts
  };

  const updateBridge = (factId: string, value: FactValue): void => {
    const bridge = values.facts[factId] ?? displayBridges[factId];
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
    <section className="template-builder__section stack" aria-labelledby="template-facts-title">
      <div className="template-builder__section-heading">
        <div>
          <h3 id="template-facts-title">Facts</h3>
          <p className="muted">
            Attach sheet-compatible Facts. Values are evaluated by the backend after save.
          </p>
        </div>
        {onCreateNew ? (
          <button
            type="button"
            className="button button--secondary"
            onClick={() => onCreateNew("fact")}
          >
            Create new Fact…
          </button>
        ) : null}
      </div>
      <SheetFactsSection
        definitions={definitions}
        bridges={displayBridges}
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
