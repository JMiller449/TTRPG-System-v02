import { useState } from "react";
import type { ActionPresetTemplate } from "@/features/actions/actionEditorValues";
import { Field } from "@/shared/ui/Field";

export function ActionPresetPicker({
  presets,
  onApply,
  disabled = false
}: {
  presets: ActionPresetTemplate[];
  onApply: (preset: ActionPresetTemplate) => void;
  disabled?: boolean;
}): JSX.Element | null {
  const [selectedPresetId, setSelectedPresetId] = useState("");
  if (presets.length === 0) {
    return null;
  }

  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId);
  const categories = Array.from(new Set(presets.map((preset) => preset.category)));

  return (
    <section className="stack">
      <div>
        <h3>Start from an Action Preset</h3>
        <p className="muted">
          Presets create an editable draft. Weapon presets require an explicit source item when
          performed; spell presets require selecting a proficiency before saving.
        </p>
      </div>
      <div className="inline-actions">
        <Field label="Action Preset">
          <select
            disabled={disabled}
            value={selectedPresetId}
            onChange={(event) => setSelectedPresetId(event.target.value)}
          >
            <option value="">Select an Action preset</option>
            {categories.map((category) => (
              <optgroup key={category} label={category.replace(/_/g, " ")}>
                {presets
                  .filter((preset) => preset.category === category)
                  .map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <button
          type="button"
          className="button"
          disabled={disabled || !selectedPreset}
          onClick={() => {
            if (!selectedPreset) {
              return;
            }
            onApply(selectedPreset);
            setSelectedPresetId("");
          }}
        >
          Apply Action Preset
        </button>
      </div>
      {selectedPreset ? <p className="muted">{selectedPreset.description}</p> : null}
    </section>
  );
}
