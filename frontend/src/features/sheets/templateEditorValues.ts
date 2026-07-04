import type {
  ActionDefinition,
  AttributeBridge,
  AttributeDefinition,
  AttributeValue,
  Formula,
  ItemDefinition,
  ProficiencyDefinition,
  Sheet,
  SheetKind,
  Stats
} from "@/domain/models";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import { normalizeFormulaTags } from "@/features/formulas/formulaTags";
import {
  FORMULA_STAT_KEYS,
  parseResistancePercentDraft,
  toResistancePercentDraft,
  type SheetFormulaStatName
} from "@/features/sheets/sheetDefinitionEditing";
import {
  CORE_TEMPLATE_STATS,
  type CoreTemplateStatKey,
  type TemplateEditorErrors,
  type TemplateEditorSection,
  type TemplateEditorValues
} from "@/features/sheets/templateEditorTypes";
import type { SheetDefinitionPayload } from "@/infrastructure/ws/requestBuilders";

export interface InstancedSheetCreationValues {
  instanceId: string;
  parentSheetId: string;
  health: number;
  mana: number;
  notes: string;
  generateAccessCode: boolean;
}

export interface TemplateReferenceCatalogs {
  actions: Record<string, ActionDefinition>;
  proficiencies: Record<string, ProficiencyDefinition>;
  items: Record<string, ItemDefinition>;
  attributes: Record<string, AttributeDefinition>;
}

export interface TemplateEditorValidation {
  errors: TemplateEditorErrors;
  isValid: boolean;
}

export type SheetFormulaStatDefaults = NonNullable<
  ActionFormulaAuthoringMetadata["sheet_formula_stat_defaults"]
>;

function cloneFormula(formula: Formula): Formula {
  return {
    aliases: formula.aliases?.map((alias) => ({ ...alias, path: [...alias.path] })) ?? null,
    text: formula.text,
    tags: [...(formula.tags ?? [])]
  };
}

export function createDefaultStats(defaults: SheetFormulaStatDefaults): Stats {
  const formulas = new Map(defaults.map((entry) => [entry.stat_name, entry.formula]));
  const formula = (statName: SheetFormulaStatName): Formula => {
    const authoredDefault = formulas.get(statName);
    return authoredDefault ? cloneFormula(authoredDefault) : { aliases: null, text: "", tags: [] };
  };
  return {
    strength: 0,
    dexterity: 0,
    constitution: 0,
    perception: 0,
    arcane: 0,
    will: 0,
    lifting: formula("lifting"),
    carry_weight: formula("carry_weight"),
    acrobatics: formula("acrobatics"),
    stamina: formula("stamina"),
    reaction_time: formula("reaction_time"),
    health: formula("health"),
    endurance: formula("endurance"),
    pain_tolerance: formula("pain_tolerance"),
    sight_distance: formula("sight_distance"),
    intuition: formula("intuition"),
    registration: formula("registration"),
    mana: formula("mana"),
    control: formula("control"),
    sensitivity: formula("sensitivity"),
    charisma: formula("charisma"),
    mental_fortitude: formula("mental_fortitude"),
    courage: formula("courage")
  };
}

function createFormulaStats(stats: Stats): Record<SheetFormulaStatName, Formula> {
  return Object.fromEntries(
    FORMULA_STAT_KEYS.map((key) => [key, cloneFormula(stats[key])])
  ) as Record<SheetFormulaStatName, Formula>;
}

function createRequiredSheetAttributes(
  definitions: Record<string, AttributeDefinition>
): Record<string, AttributeBridge> {
  return Object.fromEntries(
    Object.values(definitions)
      .filter((definition) => definition.required && definition.subject_types.includes("sheet"))
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
  );
}

export function createEmptyTemplateEditorValues(
  kind: SheetKind = "player",
  attributeDefinitions: Record<string, AttributeDefinition> = {},
  formulaDefaults: SheetFormulaStatDefaults = []
): TemplateEditorValues {
  const stats = createDefaultStats(formulaDefaults);
  return {
    kind,
    name: "",
    notes: "",
    xpGivenWhenSlayed: "0",
    xpCap: "",
    coreStats: CORE_TEMPLATE_STATS.reduce(
      (acc, key) => ({ ...acc, [key]: "0" }),
      {} as TemplateEditorValues["coreStats"]
    ),
    formulaStats: createFormulaStats(stats),
    attributes: createRequiredSheetAttributes(attributeDefinitions),
    resistances: toResistancePercentDraft(undefined),
    actions: [],
    proficiencies: [],
    items: [],
    slayedRecord: {}
  };
}

function parseCoreStats(
  values: TemplateEditorValues["coreStats"]
): Record<CoreTemplateStatKey, number> | null {
  const entries = CORE_TEMPLATE_STATS.map((key) => [key, Number(values[key])] as const);
  if (
    CORE_TEMPLATE_STATS.some((key) => !values[key].trim()) ||
    entries.some(([, value]) => !Number.isInteger(value))
  ) {
    return null;
  }
  return Object.fromEntries(entries) as Record<CoreTemplateStatKey, number>;
}

function parseNonnegativeInteger(raw: string): number | null {
  const parsed = Number(raw.trim());
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function hasDuplicates(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

function emptyErrors(): TemplateEditorErrors {
  return {
    details: [],
    stats: [],
    attributes: [],
    resistances: [],
    actions: [],
    proficiencies: [],
    inventory: []
  };
}

export function validateTemplateEditorValues(
  values: TemplateEditorValues,
  catalogs: TemplateReferenceCatalogs
): TemplateEditorValidation {
  const errors = emptyErrors();

  if (!values.name.trim()) {
    errors.details.push("Template name is required.");
  }
  if (parseNonnegativeInteger(values.xpGivenWhenSlayed) === null) {
    errors.details.push("XP awarded must be a whole number of zero or greater.");
  }

  if (!parseCoreStats(values.coreStats)) {
    errors.stats.push("Every core stat must be a finite whole number.");
  }
  const invalidFormula = FORMULA_STAT_KEYS.find((key) => {
    const formula = values.formulaStats[key];
    return (
      !formula.text.trim() ||
      (formula.aliases ?? []).some(
        (alias) => !alias.name.trim() || alias.path.length === 0 || alias.path.some((part) => !part)
      )
    );
  });
  if (invalidFormula) {
    errors.stats.push("Every formula stat needs a formula and valid variable aliases.");
  }

  const attributeDefinitions = catalogs.attributes ?? {};
  const attributeEntries = Object.entries(values.attributes);
  const attributeBridges = attributeEntries.map(([, bridge]) => bridge);
  const attributeRelationshipIds = attributeBridges.map((bridge) => bridge.relationship_id);
  if (hasDuplicates(attributeRelationshipIds) || attributeRelationshipIds.some((id) => !id)) {
    errors.attributes.push("Attribute assignments must have unique relationship IDs.");
  }
  if (attributeEntries.some(([attributeId, bridge]) => attributeId !== bridge.attribute_id)) {
    errors.attributes.push("Every Attribute assignment key must match its Attribute definition ID.");
  }
  if (
    attributeBridges.some(
      (bridge) =>
        !attributeDefinitions[bridge.attribute_id] ||
        !attributeDefinitions[bridge.attribute_id]?.subject_types.includes("sheet")
    )
  ) {
    errors.attributes.push(
      "Every attached Attribute must support sheets and reference an available definition."
    );
  }
  if (
    Object.values(attributeDefinitions).some(
      (definition) =>
        definition.required &&
        definition.subject_types.includes("sheet") &&
        !values.attributes[definition.id]
    )
  ) {
    errors.attributes.push("Every required sheet Attribute must remain attached.");
  }
  if (attributeBridges.some((bridge) => !isValidAttributeValue(bridge.value))) {
    errors.attributes.push("Every Attribute needs a valid value or formula.");
  }

  if (!parseResistancePercentDraft(values.resistances)) {
    errors.resistances.push("Every resistance must be a number from 0 to 100 percent.");
  }

  const actionIds = values.actions.map((entry) => entry.actionId);
  const actionRelationshipIds = values.actions.map((entry) => entry.relationshipId);
  if (hasDuplicates(actionIds)) {
    errors.actions.push("An action can only be assigned once.");
  }
  if (hasDuplicates(actionRelationshipIds) || actionRelationshipIds.some((id) => !id)) {
    errors.actions.push("Action assignments must have unique relationship IDs.");
  }
  if (actionIds.some((id) => !catalogs.actions[id])) {
    errors.actions.push("Every assigned action must reference an available definition.");
  }

  const proficiencyIds = values.proficiencies.map((entry) => entry.proficiencyId);
  const proficiencyRelationshipIds = values.proficiencies.map((entry) => entry.relationshipId);
  if (hasDuplicates(proficiencyIds)) {
    errors.proficiencies.push("A proficiency can only be assigned once.");
  }
  if (hasDuplicates(proficiencyRelationshipIds) || proficiencyRelationshipIds.some((id) => !id)) {
    errors.proficiencies.push("Proficiency assignments must have unique relationship IDs.");
  }
  if (proficiencyIds.some((id) => !catalogs.proficiencies[id])) {
    errors.proficiencies.push("Every assigned proficiency must reference an available definition.");
  }
  if (
    values.proficiencies.some(
      (entry) =>
        parseNonnegativeInteger(entry.useCount) === null ||
        !Number.isFinite(Number(entry.growthRate)) ||
        Number(entry.growthRate) < 0
    )
  ) {
    errors.proficiencies.push("Use count and growth rate must be zero or greater.");
  }

  const itemIds = values.items.map((entry) => entry.itemId);
  const itemRelationshipIds = values.items.map((entry) => entry.relationshipId);
  if (hasDuplicates(itemIds)) {
    errors.inventory.push("An item can only be assigned once; adjust its quantity instead.");
  }
  if (hasDuplicates(itemRelationshipIds) || itemRelationshipIds.some((id) => !id)) {
    errors.inventory.push("Inventory assignments must have unique relationship IDs.");
  }
  if (itemIds.some((id) => !catalogs.items[id])) {
    errors.inventory.push("Every inventory entry must reference an available item.");
  }
  if (values.items.some((entry) => parseNonnegativeInteger(entry.count) === null)) {
    errors.inventory.push("Item quantities must be whole numbers of zero or greater.");
  }
  if (
    values.items.some((entry) => {
      const item = catalogs.items[entry.itemId];
      return (
        entry.equipped && (item?.interaction_type !== "equippable" || Number(entry.count) <= 0)
      );
    })
  ) {
    errors.inventory.push("Only positive-quantity equippable items can start equipped.");
  }

  return {
    errors,
    isValid: (Object.keys(errors) as TemplateEditorSection[]).every(
      (section) => errors[section].length === 0
    )
  };
}

export function toTemplateEditorValues(sheet: Sheet): TemplateEditorValues {
  const coreStats = Object.fromEntries(
    CORE_TEMPLATE_STATS.map((key) => [key, String(sheet.stats[key])])
  ) as TemplateEditorValues["coreStats"];
  return {
    kind: sheet.dm_only ? "enemy" : "player",
    name: sheet.name,
    notes: sheet.notes ?? "",
    xpGivenWhenSlayed: String(sheet.xp_given_when_slayed),
    xpCap: sheet.xp_cap ?? "",
    coreStats,
    formulaStats: createFormulaStats(sheet.stats),
    attributes: structuredClone(sheet.attributes ?? {}),
    resistances: toResistancePercentDraft(sheet.resistances),
    actions: Object.values(sheet.actions).map((bridge) => ({
      relationshipId: bridge.relationship_id,
      actionId: bridge.entry_id
    })),
    proficiencies: Object.values(sheet.proficiencies).map((bridge) => ({
      relationshipId: bridge.relationship_id,
      proficiencyId: bridge.prof_id,
      useCount: String(bridge.use_count),
      growthRate: String(bridge.growth_rate)
    })),
    items: Object.values(sheet.items).map((bridge) => ({
      relationshipId: bridge.relationship_id,
      itemId: bridge.item_id,
      count: String(bridge.count),
      equipped: bridge.equipped
    })),
    slayedRecord: Object.fromEntries(
      Object.entries(sheet.slayed_record).map(([key, bridge]) => [key, { ...bridge }])
    )
  };
}

export function toSheetDefinitionPayload(
  values: TemplateEditorValues,
  sheetId: string
): SheetDefinitionPayload {
  const coreStats = parseCoreStats(values.coreStats);
  const resistances = parseResistancePercentDraft(values.resistances);
  const xpGivenWhenSlayed = parseNonnegativeInteger(values.xpGivenWhenSlayed);
  if (!coreStats || !resistances || xpGivenWhenSlayed === null) {
    throw new Error("Cannot build a sheet payload from an invalid template draft.");
  }

  const formulaStats = Object.fromEntries(
    FORMULA_STAT_KEYS.map((key) => [
      key,
      {
        ...cloneFormula(values.formulaStats[key]),
        text: values.formulaStats[key].text.trim(),
        tags: normalizeFormulaTags(values.formulaStats[key].tags ?? [])
      }
    ])
  ) as Record<SheetFormulaStatName, Formula>;

  return {
    id: sheetId,
    name: values.name.trim(),
    notes: values.notes.trim(),
    dm_only: values.kind === "enemy",
    xp_given_when_slayed: xpGivenWhenSlayed,
    xp_cap: values.xpCap.trim(),
    proficiencies: Object.fromEntries(
      values.proficiencies.map((entry) => [
        entry.relationshipId,
        {
          relationship_id: entry.relationshipId,
          prof_id: entry.proficiencyId,
          use_count: Number(entry.useCount),
          growth_rate: Number(entry.growthRate)
        }
      ])
    ),
    items: Object.fromEntries(
      values.items.map((entry) => [
        entry.relationshipId,
        {
          relationship_id: entry.relationshipId,
          item_id: entry.itemId,
          count: Number(entry.count),
          equipped: entry.equipped
        }
      ])
    ),
    stats: { ...coreStats, ...formulaStats },
    resistances,
    slayed_record: values.slayedRecord,
    actions: Object.fromEntries(
      values.actions.map((entry) => [
        entry.relationshipId,
        { relationship_id: entry.relationshipId, entry_id: entry.actionId }
      ])
    ),
    attributes: Object.fromEntries(
      Object.entries(values.attributes).map(([attributeId, bridge]) => [
        attributeId,
        {
          relationship_id: bridge.relationship_id,
          attribute_id: bridge.attribute_id,
          value: structuredClone(bridge.value),
          evaluated_value: null,
          evaluation_error: null
        }
      ])
    )
  };
}

export function toUpdatedSheetDefinitionPayload(
  sheet: Sheet,
  values: TemplateEditorValues
): SheetDefinitionPayload {
  return toSheetDefinitionPayload(values, sheet.id);
}

function parseFiniteFormulaNumber(text: string): number | null {
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function isValidAttributeValue(value: AttributeValue): boolean {
  if (value.type === "formula") {
    return (
      Boolean(value.formula.text.trim()) &&
      (value.formula.aliases ?? []).every(
        (alias) =>
          Boolean(alias.name.trim()) &&
          alias.path.length > 0 &&
          alias.path.every((part) => Boolean(part.trim()))
      )
    );
  }
  if (value.type === "number") {
    return Number.isFinite(value.value);
  }
  return value.type !== "reference" || Boolean(value.value.trim());
}

function parseIntegerFormulaNumber(text: string): number | null {
  const parsed = Number(text);
  return Number.isFinite(parsed) && Number.isInteger(parsed) ? parsed : null;
}

export function toInstancedSheetCreationValues(
  sheet: Sheet,
  kind: SheetKind,
  instanceId: string
): InstancedSheetCreationValues {
  return {
    instanceId,
    parentSheetId: sheet.id,
    health: parseFiniteFormulaNumber(sheet.stats.health.text) ?? sheet.stats.constitution,
    mana: parseIntegerFormulaNumber(sheet.stats.mana.text) ?? Math.trunc(sheet.stats.arcane),
    notes: "",
    generateAccessCode: kind === "player"
  };
}
