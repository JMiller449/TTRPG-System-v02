import { useMemo } from "react";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import type { AttributeDefinition, ProficiencyDefinition } from "@/domain/models";
import { SheetAttributesSection } from "@/features/sheets/components/SheetAttributesSection";
import { setItemAttributeProfile, type ItemEditorValues } from "@/features/items/itemEditorValues";
import { makeId } from "@/shared/utils/id";
import { selectAuthoritativeProficiencies } from "@/features/items/proficiencyOptions";

export function ItemAttributesEditor({
  values,
  definitions,
  proficiencies,
  metadata,
  onChange
}: {
  values: ItemEditorValues;
  definitions: Record<string, AttributeDefinition>;
  proficiencies: Record<string, ProficiencyDefinition>;
  metadata: ActionFormulaAuthoringMetadata | null;
  onChange: (values: ItemEditorValues) => void;
}): JSX.Element {
  const authoritativeProficiencies = useMemo(
    () => selectAuthoritativeProficiencies(proficiencies),
    [proficiencies]
  );
  const profiles = useMemo(
    () =>
      Array.from(
        new Set(
          Object.values(definitions)
            .map((definition) => definition.required_profile)
            .filter((profile): profile is "weapon" => Boolean(profile))
        )
      ).sort(),
    [definitions]
  );
  const displayDefinitions = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(definitions).map(([attributeId, definition]) => [
          attributeId,
          definition.reference_kind === "proficiency"
            ? {
                ...definition,
                validation_options: authoritativeProficiencies.map((proficiency) => proficiency.id)
              }
            : definition
        ])
      ),
    [authoritativeProficiencies, definitions]
  );
  const validationOptionLabels = useMemo(
    () =>
      Object.fromEntries(
        Object.values(definitions)
          .filter((definition) => definition.reference_kind === "proficiency")
          .map((definition) => [
            definition.id,
            Object.fromEntries(
              authoritativeProficiencies.map((proficiency) => [proficiency.id, proficiency.name])
            )
          ])
      ),
    [authoritativeProficiencies, definitions]
  );

  const updateBridge = (
    attributeId: string,
    value: ItemEditorValues["attributes"][string]["value"]
  ): void => {
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
          Profiles attach backend-required Attributes. Optional Attributes can be added to the same
          item.
        </p>
      </div>
      <label>
        Attribute profile
        <select
          value={values.attributeProfile ?? ""}
          onChange={(event) =>
            onChange(
              setItemAttributeProfile(
                values,
                event.target.value ? (event.target.value as "weapon") : null,
                definitions
              )
            )
          }
        >
          <option value="">No required profile</option>
          {profiles.map((profile) => (
            <option key={profile} value={profile}>
              {profile.charAt(0).toUpperCase() + profile.slice(1)}
            </option>
          ))}
        </select>
      </label>
      <SheetAttributesSection
        definitions={displayDefinitions}
        bridges={values.attributes}
        canEdit
        subjectType="item"
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
                relationship_id: makeId("item_attribute"),
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
