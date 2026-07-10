import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Augmentation } from "@/domain/models";
import { createEmptyAugmentationEditorValues } from "@/features/augmentations/augmentationEditorValues";
import { createEmptyConditionPresetEditorValues } from "@/features/conditions/conditionEditorValues";
import { ConditionAugmentationTemplatePanel } from "@/features/conditions/components/ConditionAugmentationTemplatePanel";
import { ConditionPresetEditorForm } from "@/features/conditions/components/ConditionPresetEditorForm";

const selectorOptions = {
  tags: [],
  actions: [],
  formulas: [],
  steps: []
};

function renderEditor(effectEditorOpen: boolean): string {
  const values = createEmptyConditionPresetEditorValues();
  if (effectEditorOpen) {
    values.name = "Poisoned";
  }
  return renderToStaticMarkup(
    <ConditionPresetEditorForm
      editingConditionId={null}
      values={values}
      onChange={() => undefined}
      onSubmit={() => undefined}
      onCancel={() => undefined}
      hasOpenEffectEditor={effectEditorOpen}
      effectEditor={
        <ConditionAugmentationTemplatePanel
          conditionName="New condition"
          editorOpen={effectEditorOpen}
          editingAugmentationId={null}
          templates={values.augmentationTemplates}
          targetOptions={[]}
          selectorOptions={selectorOptions}
          values={createEmptyAugmentationEditorValues()}
          onChange={() => undefined}
          onAdd={() => undefined}
          onSubmit={() => undefined}
          onCancel={() => undefined}
          onEdit={() => undefined}
          onRemove={() => undefined}
        />
      }
    />
  );
}

describe("ConditionPresetEditorForm", () => {
  it("keeps the Effects section visible during initial condition creation", () => {
    const markup = renderEditor(false);

    expect(markup).toContain("Effects");
    expect(markup).toContain("Add Effect");
    expect(markup).toContain("No effects configured.");
    expect(markup).not.toContain("Condition Augmentations");
    expect(markup).toContain("Name is required.");
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain("disabled");
  });

  it("labels lifecycle fields and validates incomplete effects", () => {
    const markup = renderEditor(true);

    expect(markup).toContain("Lifecycle (GM-tracked)");
    expect(markup).toContain("Expiration note");
    expect(markup).toContain("Remove when source inactive");
    expect(markup).toContain("Effect name is required.");
    expect(markup).toContain("Save or cancel the open effect before saving the condition.");
  });

  it("shows selector-only condition behavior without a meaningless target", () => {
    const effect: Augmentation = {
      id: "shadow_bound_dodge_penalty",
      name: "Dodge Disadvantage",
      description: "Dodge checks roll with disadvantage while restrained.",
      source: { type: "condition" },
      scope: "instance",
      target: { root: "instance", path: ["mana"] },
      effect: {
        type: "roll_mode_modifier",
        roll_mode: "disadvantage",
        selector: { required_tags: ["check", "dodge"] }
      }
    };
    const markup = renderToStaticMarkup(
      <ConditionAugmentationTemplatePanel
        conditionName="Shadow Bound"
        editorOpen={false}
        editingAugmentationId={null}
        templates={[effect]}
        targetOptions={[]}
        selectorOptions={selectorOptions}
        values={createEmptyAugmentationEditorValues()}
        onChange={() => undefined}
        onAdd={() => undefined}
        onSubmit={() => undefined}
        onCancel={() => undefined}
        onEdit={() => undefined}
        onRemove={() => undefined}
      />
    );

    expect(markup).toContain("Behavior: Disadvantage on matching rolls");
    expect(markup).toContain("Applies to: tags check + dodge");
    expect(markup).not.toContain("instance.mana");
    expect(markup).not.toContain("Target:");
  });
});
