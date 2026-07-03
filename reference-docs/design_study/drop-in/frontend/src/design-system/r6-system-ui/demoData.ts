import type { R6Action, R6InventoryItem, R6Stat, R6Tab } from "./types";

export const demoTabs: R6Tab[] = [
  { id: "status", label: "Status" },
  { id: "actions", label: "Actions", badge: 4 },
  { id: "equipment", label: "Equipment", badge: 7 },
  { id: "proficiencies", label: "Proficiencies" },
  { id: "conditions", label: "Conditions", badge: 2 }
];

export const demoStats: R6Stat[] = [
  { key: "strength", shortLabel: "STR", label: "Strength", value: 148, modifier: 22, glyph: "◆", description: "Power, lifting, blocking, and strength weapons." },
  { key: "dexterity", shortLabel: "DEX", label: "Dexterity", value: 121, modifier: 16, glyph: "◇", description: "Speed, reaction, dodging, and dexterity weapons." },
  { key: "constitution", shortLabel: "CON", label: "Constitution", value: 134, modifier: 18, glyph: "✚", description: "Health, endurance, and pain tolerance." },
  { key: "perception", shortLabel: "PER", label: "Perception", value: 96, modifier: 9, glyph: "◉", description: "Sight, intuition, and registration." },
  { key: "arcane", shortLabel: "ARC", label: "Arcane", value: 112, modifier: 14, glyph: "✦", description: "Mana, control, and magical sensitivity." },
  { key: "will", shortLabel: "WIL", label: "Will", value: 88, modifier: 7, glyph: "⬡", description: "Charisma, courage, and mental fortitude." }
];

export const demoActions: R6Action[] = [
  {
    id: "longsword-strike",
    name: "Longsword Strike",
    category: "Physical Attack",
    governingStat: "Strength",
    cost: "1 action",
    formula: "(1 + proficiency) × (d100 ÷ 100) × STR",
    description: "Make a strength-based weapon attack. The target may spend a reaction to dodge, block, or parry.",
    tags: ["Melee", "Weapon"]
  },
  {
    id: "arc-burst",
    name: "Arc Burst",
    category: "Ability",
    governingStat: "Arcane",
    cost: "2 actions · 18 mana",
    formula: "1.35 × (d100 ÷ 100) × ARC",
    description: "Release condensed mana in a short cone. Targets may attempt an applicable reaction.",
    tags: ["Arcane", "Area"]
  }
];

export const demoItems: R6InventoryItem[] = [
  {
    id: "riftblade",
    name: "Rift-Tempered Longsword",
    category: "Weapon",
    quantity: 1,
    equipped: true,
    rarity: "rare",
    description: "A balanced blade that hums near unstable mana.",
    tags: ["Strength", "Parry", "+12 damage"]
  },
  {
    id: "mana-potion",
    name: "Concentrated Mana Vial",
    category: "Consumable",
    quantity: 3,
    rarity: "uncommon",
    description: "Restores 80 mana after use.",
    tags: ["Consumable", "Mana"]
  }
];
