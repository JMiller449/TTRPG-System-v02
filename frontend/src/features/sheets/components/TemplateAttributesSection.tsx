import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import type { AttributeDefinition, AttributeValue } from "@/domain/models";
import { SheetAttributesSection } from "@/features/sheets/components/SheetAttributesSection";
import type { TemplateEditorValues } from "@/features/sheets/templateEditorTypes";
import { makeId } from "@/shared/utils/id";
import type { TemplateContextualEntityKind } from "@/features/sheets/templateContextualAuthoring";

export function TemplateAttributesSection({
  values,
  definitions,
  metadata,
  onCreateNew,
  onChange
}: {
  values: TemplateEditorValues;
  definitions: Record<string, AttributeDefinition>;
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
            !values.attributes[definition.id]
        )
        .map((definition) => [
          definition.id,
          {
            relationship_id: `required_attribute_${definition.id}`,
            attribute_id: definition.id,
            value: structuredClone(definition.default_value),
            evaluated_value: null,
            evaluation_error: null
          }
        ])
    ),
    ...values.attributes
  };

  const updateBridge = (attributeId: string, value: AttributeValue): void => {
    const bridge = values.attributes[attributeId] ?? displayBridges[attributeId];
    if (!bridge) {
      return;
    }
    onChange({
      ...values,
      attributes: {
        ...values.attributes,
        [attributeId]: {
          ...bridge,
          value,
          evaluated_value: null,
          evaluation_error: null
        }
      }
    });
  };

  return (
    <section className="template-builder__section stack" aria-labelledby="template-attributes-title">
      <div className="template-builder__section-heading">
        <div>
          <h3 id="template-attributes-title">Attributes</h3>
          <p className="muted">
            Optional named values for campaign-specific rules, such as movement speed, ancestry,
            or reaction count. Most templates do not need a custom Attribute.
          </p>
        </div>
        {onCreateNew ? (
          <button
            type="button"
            className="button button--secondary"
            onClick={() => onCreateNew("attribute")}
          >
            Create reusable Attribute…
          </button>
        ) : null}
      </div>
      <SheetAttributesSection
        definitions={definitions}
        bridges={displayBridges}
        canEdit
        subjectType="sheet"
        formulaMetadata={metadata}
        onSaveFormula={(attributeId, formula) => updateBridge(attributeId, { type: "formula", formula })}
        onSaveValue={updateBridge}
        onReset={(attributeId) => {
          const definition = definitions[attributeId];
          if (definition) {
            updateBridge(attributeId, structuredClone(definition.default_value));
          }
        }}
        onAttach={(attributeId) => {
          const definition = definitions[attributeId];
          if (!definition) {
            return;
          }
          onChange({
            ...values,
            attributes: {
              ...values.attributes,
              [attributeId]: {
                relationship_id: makeId("sheet_attribute"),
                attribute_id: attributeId,
                value: structuredClone(definition.default_value),
                evaluated_value: null,
                evaluation_error: null
              }
            }
          });
        }}
        onDetach={(attributeId) => {
          const attributes = { ...values.attributes };
          delete attributes[attributeId];
          onChange({ ...values, attributes });
        }}
      />
    </section>
  );
}
