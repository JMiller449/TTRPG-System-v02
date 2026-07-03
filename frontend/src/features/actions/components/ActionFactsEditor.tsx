import { useMemo, useState } from "react";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import type { FactDefinition, FactValue, ProficiencyDefinition } from "@/domain/models";
import {
  applyActionFactValues,
  type ActionEditorValues
} from "@/features/actions/actionEditorValues";
import { SheetFactsSection } from "@/features/sheets/components/SheetFactsSection";
import { makeId } from "@/shared/utils/id";

export function ActionFactsEditor({
  values,
  definitions,
  proficiencies,
  metadata,
  onChange
}: {
  values: ActionEditorValues;
  definitions: Record<string, FactDefinition>;
  proficiencies: Record<string, ProficiencyDefinition>;
  metadata: ActionFormulaAuthoringMetadata | null;
  onChange: (values: ActionEditorValues) => void;
}): JSX.Element {
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const presets = metadata?.action_fact_presets ?? [];
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

  const applyPreset = (): void => {
    const preset = presets.find((candidate) => candidate.id === selectedPresetId);
    if (!preset) {
      return;
    }
    onChange(
      applyActionFactValues(values, preset.fact_values, definitions, () => makeId("action_fact"))
    );
    setSelectedPresetId("");
  };

  return (
    <section className="card stack">
      <div>
        <h3>Facts</h3>
        <p className="muted">
          Presets attach authored configuration only. A formula or step must explicitly consume a
          Fact before it affects execution.
        </p>
      </div>
      {presets.length > 0 ? (
        <div className="inline-actions">
          <label>
            Fact preset
            <select
              value={selectedPresetId}
              onChange={(event) => setSelectedPresetId(event.target.value)}
            >
              <option value="">Select a Fact preset</option>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" disabled={!selectedPresetId} onClick={applyPreset}>
            Apply Fact Preset
          </button>
        </div>
      ) : null}
      <SheetFactsSection
        definitions={displayDefinitions}
        bridges={values.facts}
        canEdit
        subjectType="action"
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
                relationship_id: makeId("action_fact"),
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
