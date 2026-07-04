import type { AssignedSheetAction, ActiveStandaloneEffect } from "@/app/state/selectors";
import type {
  ActionDefinition,
  Augmentation,
  FactBridge,
  FactDefinition,
  ItemBridge,
  ItemDefinition
} from "@/domain/models";

function fact(
  factId: string,
  type: FactBridge["value"]["type"],
  value: number | string
): FactBridge {
  const factValue =
    type === "number"
      ? ({ type, value: Number(value) } as const)
      : type === "enum"
        ? ({ type, value: String(value) } as const)
        : ({ type: "text", value: String(value) } as const);
  return {
    relationship_id: `fixture_fact_${factId}`,
    fact_id: factId,
    value: factValue,
    evaluated_value: factValue.value,
    evaluation_error: null
  };
}

function selector(requiredTags: string[] = [], sameSourceItem = false) {
  return {
    required_tags: requiredTags,
    excluded_tags: [],
    action_id: null,
    formula_id: null,
    step_id: null,
    same_source_item: sameSourceItem
  };
}

function directEffect(
  id: string,
  name: string,
  root: "sheet" | "instance",
  path: string[],
  value: string
): Augmentation {
  return {
    id,
    name,
    source: { type: "item" },
    scope: root,
    target: { root, path },
    effect: {
      type: "formula_modifier",
      operation: "add",
      value: { aliases: null, text: value, tags: [] },
      selector: selector()
    },
    active: true,
    applied: false
  };
}

function evaluationEffect(
  id: string,
  name: string,
  value: string,
  requiredTags: string[],
  sameSourceItem = false
): Augmentation {
  return {
    id,
    name,
    source: { type: "item" },
    scope: "instance",
    target: { root: "instance", path: ["mana"] },
    effect: {
      type: "evaluation_formula_modifier",
      operation: "add",
      value: { aliases: null, text: value, tags: [] },
      selector: selector(requiredTags, sameSourceItem)
    },
    active: true,
    applied: false
  };
}

function rollEffect(id: string, name: string, requiredTags: string[]): Augmentation {
  return {
    id,
    name,
    source: { type: "item" },
    scope: "instance",
    target: { root: "instance", path: ["mana"] },
    effect: {
      type: "roll_mode_modifier",
      roll_mode: "advantage",
      selector: selector(requiredTags)
    },
    active: true,
    applied: false
  };
}

export const dmExampleFactDefinitions: Record<string, FactDefinition> = {
  action_rank: {
    id: "action_rank",
    name: "Rank",
    subject_types: ["action"],
    value_type: "enum",
    default_value: { type: "enum", value: "F" }
  },
  weapon_base_damage: {
    id: "weapon_base_damage",
    name: "Base Damage",
    subject_types: ["item"],
    value_type: "number",
    default_value: { type: "number", value: 0 },
    unit: "damage",
    required: true,
    required_profile: "weapon"
  },
  item_attribute: {
    id: "item_attribute",
    name: "Attribute",
    subject_types: ["item"],
    value_type: "text",
    default_value: { type: "text", value: "" }
  },
  item_mana_efficiency: {
    id: "item_mana_efficiency",
    name: "Mana Efficiency",
    subject_types: ["item"],
    value_type: "number",
    default_value: { type: "number", value: 100 },
    unit: "%"
  },
  item_flat_effect_bonus: {
    id: "item_flat_effect_bonus",
    name: "Flat Effect Bonus",
    subject_types: ["item"],
    value_type: "number",
    default_value: { type: "number", value: 0 },
    unit: "bonus"
  },
  item_mana_regeneration_modifier: {
    id: "item_mana_regeneration_modifier",
    name: "Mana Regeneration Modifier",
    subject_types: ["item"],
    value_type: "number",
    default_value: { type: "number", value: 0 },
    unit: "%"
  }
};

const lightStepsEffects = [
  directEffect(
    "light_steps_resistance",
    "Light Steps Resistance",
    "sheet",
    ["resistances", "resistance"],
    "0.10"
  ),
  rollEffect("light_steps_stealth", "Light Steps Stealth Advantage", ["check", "stealth"])
];
const neverDullsEffects: Augmentation[] = [];
const fireShardEffects = [
  evaluationEffect("fire_shard_damage", "Fire Shard Damage", "10", ["damage", "fire"])
];
const helmEffects = [
  directEffect(
    "helm_of_sight_perception",
    "Helm of Sight Perception",
    "sheet",
    ["stats", "perception"],
    "2"
  )
];
const robeEffects = [
  directEffect(
    "pyromancy_robe_fire",
    "Pyromancy Robe Fire Resistance",
    "sheet",
    ["resistances", "fire"],
    "0.25"
  ),
  directEffect(
    "pyromancy_robe_magic",
    "Pyromancy Robe Magic Resistance",
    "sheet",
    ["resistances", "magical"],
    "0.10"
  )
];
const swordOfManaEffects = [
  evaluationEffect(
    "sword_of_mana_effect_bonus",
    "Sword of Mana Effect Bonus",
    "@flat_effect_bonus",
    ["damage"],
    true
  )
];

export const dmExampleItems: Record<string, ItemDefinition> = {
  light_steps: {
    id: "light_steps",
    name: "Light Steps",
    interaction_type: "equippable",
    category: "Light Armor",
    rank: "C+",
    description: "Light armor that protects its wearer and aids stealth.",
    price: "10,000 CP",
    weight: "15 lbs",
    augmentation_templates: lightStepsEffects,
    action_grants: [],
    facts: {}
  },
  never_dulls: {
    id: "never_dulls",
    name: "Never Dulls",
    interaction_type: "equippable",
    category: "Sword",
    rank: "D",
    description: "Always remains sharp and never dulls.",
    price: "500 CP",
    weight: "3 lbs",
    fact_profile: "weapon",
    augmentation_templates: neverDullsEffects,
    action_grants: [
      { action_id: "weapon_damage", availability: "equipped", consume_quantity: 0 },
      { action_id: "weapon_parry", availability: "equipped", consume_quantity: 0 }
    ],
    facts: {
      weapon_base_damage: fact("weapon_base_damage", "number", 15)
    }
  },
  fire_shard: {
    id: "fire_shard",
    name: "Fire Shard",
    interaction_type: "equippable",
    category: "Shard of Fire",
    rank: "A",
    description: "Grants the Fire attribute while equipped.",
    price: "1,000,000 CP",
    weight: "0.1 lbs",
    augmentation_templates: fireShardEffects,
    action_grants: [],
    facts: { item_attribute: fact("item_attribute", "text", "Fire") }
  },
  helm_of_sight: {
    id: "helm_of_sight",
    name: "Helm of Sight",
    interaction_type: "equippable",
    category: "Helmet",
    rank: "C",
    description: "Improves the wearer's perception.",
    price: "5,000 CP",
    weight: "2 lbs",
    augmentation_templates: helmEffects,
    action_grants: [],
    facts: {}
  },
  pyromancy_robe: {
    id: "pyromancy_robe",
    name: "Pyromancy Robe",
    interaction_type: "equippable",
    category: "Armor",
    rank: "B",
    description: "Armor specialized against fire and magical damage.",
    price: "100,000 CP",
    weight: "1 lb",
    augmentation_templates: robeEffects,
    action_grants: [],
    facts: {}
  },
  sword_of_mana: {
    id: "sword_of_mana",
    name: "Sword of Mana",
    interaction_type: "equippable",
    category: "Sword",
    rank: "S",
    description: "Conducts mana at 100% efficiency.",
    price: "N/A",
    weight: "3 lbs",
    fact_profile: "weapon",
    augmentation_templates: swordOfManaEffects,
    action_grants: [{ action_id: "weapon_damage", availability: "equipped", consume_quantity: 0 }],
    facts: {
      item_mana_efficiency: fact("item_mana_efficiency", "number", 100),
      item_flat_effect_bonus: fact("item_flat_effect_bonus", "number", 50),
      item_mana_regeneration_modifier: fact("item_mana_regeneration_modifier", "number", 25)
    }
  }
};

export const dmExampleEquipment: ItemBridge[] = Object.keys(dmExampleItems).map((itemId) => ({
  relationship_id: `inventory_${itemId}`,
  item_id: itemId,
  count: 1,
  equipped: true
}));

export const dmExampleConcreteAugmentations: Record<string, Augmentation> = Object.fromEntries(
  dmExampleEquipment.flatMap((bridge) =>
    (dmExampleItems[bridge.item_id].augmentation_templates ?? []).map((template) => [
      `concrete_${bridge.relationship_id}_${template.id}`,
      {
        ...template,
        id: `concrete_${bridge.relationship_id}_${template.id}`,
        source: { type: "item", relationship_id: bridge.relationship_id },
        lifecycle_owner: "equipment",
        active: true,
        applied: true
      }
    ])
  )
);

const rankFacts = (rank: string): Record<string, FactBridge> => ({
  action_rank: fact("action_rank", "enum", rank)
});

export const dmExampleActions: Record<string, ActionDefinition> = {
  parry_skill: {
    id: "parry_skill",
    name: "Parry",
    roll_mode_kind: "none",
    notes: "Allows Parry attempts and explicitly activates their advantage.",
    facts: rankFacts("C"),
    steps: [
      {
        step_id: "activate_parry_advantage",
        type: "apply_augmentation",
        target: "caster",
        augmentation_id: "parry_advantage",
        operation: "apply"
      }
    ]
  },
  flames_of_life: {
    id: "flames_of_life",
    name: "Flames of Life",
    roll_mode_kind: "none",
    notes: "Restores 10 health for 100 mana. Limb restoration remains roleplay-only.",
    facts: rankFacts("S"),
    steps: [
      {
        step_id: "spend_mana",
        type: "decrement_value",
        target: "caster",
        path: ["mana"],
        amount: { aliases: null, text: "100", tags: [] },
        min_value: { aliases: null, text: "0", tags: [] },
        on_min_violation: "reject"
      },
      {
        step_id: "restore_health",
        type: "increment_value",
        target: "caster",
        path: ["health"],
        amount: { aliases: null, text: "10", tags: [] },
        max_value: {
          aliases: [{ name: "max_health", path: ["stats", "health"] }],
          text: "@max_health",
          tags: []
        }
      }
    ]
  },
  mana_manipulation: {
    id: "mana_manipulation",
    name: "Mana Manipulation",
    roll_mode_kind: "none",
    notes: "Numeric improvements require GM-authored values; timed regeneration remains manual.",
    facts: rankFacts("A"),
    steps: [
      {
        step_id: "activate_mana_effect_bonus",
        type: "apply_augmentation",
        target: "caster",
        augmentation_id: "mana_manipulation_effect_bonus",
        operation: "apply"
      },
      {
        step_id: "activate_overload_advantage",
        type: "apply_augmentation",
        target: "caster",
        augmentation_id: "mana_manipulation_overload_advantage",
        operation: "apply"
      }
    ]
  }
};

export const dmExampleAssignedActions: AssignedSheetAction[] = Object.values(dmExampleActions).map(
  (action) => ({
    relationshipId: `assigned_${action.id}`,
    actionId: action.id,
    action,
    bridge: { relationship_id: `assigned_${action.id}`, entry_id: action.id }
  })
);

export const dmExampleActiveEffects: ActiveStandaloneEffect[] = [
  {
    application: {
      application_id: "standalone:dm_examples_instance:parry_advantage",
      definition_id: "parry_advantage",
      instance_id: "dm_examples_instance",
      source: {
        type: "action",
        id: "parry_skill",
        relationship_id: "activate_parry_advantage"
      },
      active: true
    },
    definition: {
      id: "parry_advantage",
      name: "Parry Advantage",
      description: "Always grants advantage on tagged Parry attempts.",
      scope: "instance",
      target: { root: "instance", path: ["mana"] },
      effect: {
        type: "roll_mode_modifier",
        roll_mode: "advantage",
        selector: selector(["check", "parry"])
      }
    },
    sourceAction: dmExampleActions.parry_skill,
    sourceStep: dmExampleActions.parry_skill.steps?.[0] ?? null
  },
  {
    application: {
      application_id: "standalone:dm_examples_instance:mana_manipulation_overload_advantage",
      definition_id: "mana_manipulation_overload_advantage",
      instance_id: "dm_examples_instance",
      source: {
        type: "action",
        id: "mana_manipulation",
        relationship_id: "activate_overload_advantage"
      },
      active: true
    },
    definition: {
      id: "mana_manipulation_overload_advantage",
      name: "Mana Manipulation Overload Advantage",
      description: "Grants advantage on tagged Overload checks.",
      scope: "instance",
      target: { root: "instance", path: ["mana"] },
      effect: {
        type: "roll_mode_modifier",
        roll_mode: "advantage",
        selector: selector(["check", "overload"])
      }
    },
    sourceAction: dmExampleActions.mana_manipulation,
    sourceStep: dmExampleActions.mana_manipulation.steps?.[1] ?? null
  }
];
