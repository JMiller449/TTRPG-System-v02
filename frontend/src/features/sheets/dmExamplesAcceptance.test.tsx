import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  toActionDefinitionPayload,
  toActionEditorValues
} from "@/features/actions/actionEditorValues";
import { toItemDefinitionPayload, toItemEditorValues } from "@/features/items/itemEditorValues";
import { SheetActionsSection } from "@/features/sheets/components/SheetActionsSection";
import { SheetEquipmentSection } from "@/features/sheets/components/SheetEquipmentSection";
import { SheetStandaloneEffectsSection } from "@/features/sheets/components/SheetStandaloneEffectsSection";
import {
  dmExampleActions,
  dmExampleActiveEffects,
  dmExampleAssignedActions,
  dmExampleConcreteAugmentations,
  dmExampleEquipment,
  dmExampleAttributeDefinitions,
  dmExampleItems
} from "@/test/fixtures/dmExamples";

describe("DM example acceptance fixtures", () => {
  it("round-trips all six equipment examples through existing authoring mappers", () => {
    for (const item of Object.values(dmExampleItems)) {
      const payload = toItemDefinitionPayload(toItemEditorValues(item), item.id);

      expect(payload.id).toBe(item.id);
      expect(payload.name).toBe(item.name);
      expect(payload.interaction_type).toBe(item.interaction_type);
      expect(payload.attributes).toEqual(item.attributes ?? {});
      expect(payload.action_grants).toEqual(item.action_grants ?? []);
      expect((payload.augmentation_templates ?? []).map((effect) => effect.id)).toEqual(
        (item.augmentation_templates ?? []).map((effect) => effect.id)
      );
    }

    const manaSwordTemplates = toItemDefinitionPayload(
      toItemEditorValues(dmExampleItems.sword_of_mana),
      "sword_of_mana"
    ).augmentation_templates;
    expect(manaSwordTemplates).toHaveLength(1);
    const manaSwordModifier = manaSwordTemplates?.[0];
    expect(manaSwordModifier?.effect.type).toBe("evaluation_formula_modifier");
    expect(manaSwordModifier?.effect.selector?.same_source_item).toBe(true);
  });

  it("round-trips the three supplied actions without changing ordered steps or Attributes", () => {
    for (const action of Object.values(dmExampleActions)) {
      expect(toActionDefinitionPayload(toActionEditorValues(action), action.id)).toEqual({
        id: action.id,
        name: action.name,
        roll_mode_kind: action.roll_mode_kind,
        notes: action.notes,
        steps: action.steps,
        attributes: action.attributes
      });
    }
  });

  it("renders authoritative equipment, Attributes, actions, and applied effects", () => {
    const equipmentMarkup = renderToStaticMarkup(
      <SheetEquipmentSection
        items={dmExampleItems}
        actionDefinitions={{
          weapon_damage: { id: "weapon_damage", name: "Weapon Damage" },
          weapon_parry: { id: "weapon_parry", name: "Weapon Parry" }
        }}
        attributeDefinitions={dmExampleAttributeDefinitions}
        proficiencyDefinitions={{}}
        augmentations={dmExampleConcreteAugmentations}
        itemOrder={Object.keys(dmExampleItems)}
        selectedItemId=""
        selectedItem={null}
        equipment={dmExampleEquipment}
        canEdit={false}
        onSelectedItemIdChange={() => undefined}
        onAddSelectedItem={() => undefined}
        onQuantityChange={() => undefined}
        onToggleEquipped={() => undefined}
        onRemoveInventoryItem={() => undefined}
      />
    );

    for (const name of [
      "Light Steps",
      "Never Dulls",
      "Fire Shard",
      "Helm of Sight",
      "Pyromancy Robe",
      "Sword of Mana"
    ]) {
      expect(equipmentMarkup).toContain(name);
    }
    expect(equipmentMarkup).toContain("15 damage");
    expect(equipmentMarkup).toContain("Fire");
    expect(equipmentMarkup).toContain("100 %");
    expect(equipmentMarkup).toContain("50 bonus");
    expect(equipmentMarkup).toContain("25 %");

    const actionsMarkup = renderToStaticMarkup(
      <SheetActionsSection
        assignedActions={dmExampleAssignedActions}
        actionDefinitions={dmExampleActions}
        attributeDefinitions={dmExampleAttributeDefinitions}
        actionOrder={Object.keys(dmExampleActions)}
        canEdit={true}
        onCreate={() => undefined}
        onUpdate={() => undefined}
        onDelete={() => undefined}
        onPerformAction={() => undefined}
      />
    );
    expect(actionsMarkup).toContain("Parry");
    expect(actionsMarkup).toContain("Flames of Life");
    expect(actionsMarkup).toContain("Mana Manipulation");
    expect(actionsMarkup).toContain("Value: </span><strong>C");
    expect(actionsMarkup).toContain("Value: </span><strong>S");
    expect(actionsMarkup).toContain("Value: </span><strong>A");

    const effectsMarkup = renderToStaticMarkup(
      <SheetStandaloneEffectsSection effects={dmExampleActiveEffects} />
    );
    expect(effectsMarkup).toContain("Parry Advantage");
    expect(effectsMarkup).toContain("Mana Manipulation Overload Advantage");
    expect(effectsMarkup).toContain("Parry · Apply or remove effect (activate_parry_advantage)");
    expect(effectsMarkup).toContain(
      "Mana Manipulation · Apply or remove effect (activate_overload_advantage)"
    );
  });
});
