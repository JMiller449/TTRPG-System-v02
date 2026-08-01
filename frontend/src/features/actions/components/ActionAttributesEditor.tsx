import { useMemo } from "react";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import type { AttributeDefinition, AttributeValue, ProficiencyDefinition } from "@/domain/models";
import type { ActionEditorValues } from "@/features/actions/actionEditorValues";
import { SheetAttributesSection } from "@/features/sheets/components/SheetAttributesSection";
import { makeId } from "@/shared/utils/id";

export function ActionAttributesEditor({
  values,
  definitions,
  proficiencies,
  metadata,
  onChange
}: {
  values: ActionEditorValues;
  definitions: Record<string, AttributeDefinition>;
  proficiencies: Record<string, ProficiencyDefinition>;
  metadata: ActionFormulaAuthoringMetadata | null;
  onChange: (values: ActionEditorValues) => void;
}): JSX.Element {
  const displayDefinitions = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(definitions).map(([attributeId, definition]) => [
          attributeId,
          definition.reference_kind === "proficiency"
            ? { ...definition, validation_options: Object.keys(proficiencies) }
            : definition
        ])
      ),
    [definitions, proficiencies]
  );
  const validationOptionLabels = useMemo(
    () =>
      Object.fromEntries(
        Object.values(definitions)
          .filter((definition) => definition.reference_kind === "proficiency")
          .map((definition) => [
            definition.id,
            Object.fromEntries(
              Object.values(proficiencies).map((proficiency) => [proficiency.id, proficiency.name])
            )
          ])
      ),
    [definitions, proficiencies]
  );

  const updateBridge = (attributeId: string, value: AttributeValue): void => {
    const bridge = values.attributes[attributeId];
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
    <section className="stack">
      <div>
        <h3>Attributes</h3>
        <p className="muted">
          Attributes describe this action (range, mana cost, and so on). They only change a roll
          when a formula or step actually references them.
        </p>
      </div>
      <SheetAttributesSection
        definitions={displayDefinitions}
        bridges={values.attributes}
        canEdit
        subjectType="action"
        draftMode
        formulaMetadata={metadata}
        validationOptionLabels={validationOptionLabels}
        onSaveFormula={(attributeId, formula) =>
          updateBridge(attributeId, { type: "formula", formula })
        }
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
                relationship_id: makeId("action_attribute"),
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
