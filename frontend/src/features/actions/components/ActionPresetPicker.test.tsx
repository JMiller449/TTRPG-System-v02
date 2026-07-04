import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActionPresetPicker } from "@/features/actions/components/ActionPresetPicker";

describe("ActionPresetPicker", () => {
  it("renders backend-provided executable preset categories", () => {
    const markup = renderToStaticMarkup(
      <ActionPresetPicker
        presets={[
          {
            id: "weapon_attack",
            label: "Weapon Attack",
            category: "weapon",
            description: "Equipment-grantable weapon attack.",
            roll_mode_kind: "check",
            steps: [],
            editable_formula_fields: [],
            attribute_values: {}
          },
          {
            id: "spell_damage",
            label: "Spell Damage",
            category: "spell",
            description: "Configurable spell damage.",
            roll_mode_kind: "damage",
            steps: [],
            editable_formula_fields: [],
            attribute_values: {}
          }
        ]}
        onApply={() => undefined}
      />
    );

    expect(markup).toContain("Start from an Action Preset");
    expect(markup).toContain('label="weapon"');
    expect(markup).toContain("Weapon Attack");
    expect(markup).toContain('label="spell"');
    expect(markup).toContain("Spell Damage");
    expect(markup).toContain("Apply Action Preset");
  });
});
