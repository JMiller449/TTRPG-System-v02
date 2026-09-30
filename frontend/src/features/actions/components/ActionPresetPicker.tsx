import { useState } from "react";
import type { ActionPresetTemplate } from "@/features/actions/actionEditorValues";
import { Field } from "@/shared/ui/Field";

export function ActionPresetPicker({
  presets,
  onApply,
  disabled = false,
  showIntro = true
}: {
  presets: ActionPresetTemplate[];
  onApply: (preset: ActionPresetTemplate) => void;
  disabled?: boolean;
  showIntro?: boolean;
}): JSX.Element | null {
  const [selectedPresetId, setSelectedPresetId] = useState("");
  if (presets.length === 0) {
    return null;
  }

  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId);
  const categories = Array.from(new Set(presets.map((preset) => preset.category)));

  return (
    <section className="stack">
      {showIntro ? (
        <div>
          <h3>Choose a Common Behavior</h3>
          <p className="muted">
            This fills an editable draft. Weapon behaviors require an explicit source item when
            performed; spell behaviors require selecting a proficiency before saving.
          </p>
        </div>
      ) : null}
      <div className="inline-actions">
        <Field label="Common behavior">
          <select
            disabled={disabled}
            value={selectedPresetId}
            onChange={(event) => setSelectedPresetId(event.target.value)}
          >
            <option value="">Select a common behavior</option>
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
          Apply Behavior
        </button>
      </div>
      {selectedPreset ? <p className="muted">{selectedPreset.description}</p> : null}
    </section>
  );
}
