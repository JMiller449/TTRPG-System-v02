import { useMemo } from "react";
import type { FactDefinition, ProficiencyDefinition } from "@/domain/models";
import { SheetFactsSection } from "@/features/sheets/components/SheetFactsSection";
import { setItemFactProfile, type ItemEditorValues } from "@/features/items/itemEditorValues";
import { makeId } from "@/shared/utils/id";

export function ItemFactsEditor({
  values,
  definitions,
  proficiencies,
  onChange
}: {
  values: ItemEditorValues;
  definitions: Record<string, FactDefinition>;
  proficiencies: Record<string, ProficiencyDefinition>;
  onChange: (values: ItemEditorValues) => void;
}): JSX.Element {
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
        Object.entries(definitions).map(([factId, definition]) => [
          factId,
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

  const updateBridge = (
    factId: string,
    value: ItemEditorValues["facts"][string]["value"]
  ): void => {
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
          Profiles attach backend-required Facts. Optional Facts can be added to the same item.
        </p>
      </div>
      <label>
        Fact profile
        <select
          value={values.factProfile ?? ""}
          onChange={(event) =>
            onChange(
              setItemFactProfile(
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
      <SheetFactsSection
        definitions={displayDefinitions}
        bridges={values.facts}
        canEdit
        subjectType="item"
        validationOptionLabels={validationOptionLabels}
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
                relationship_id: makeId("item_fact"),
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
