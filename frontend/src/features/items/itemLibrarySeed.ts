import type { ItemTemplate } from "@/domain/models";

const REFERENCE_SEED_UPDATED_AT = "2026-02-22T00:00:00.000Z";

// TODO: Confirm immediate vs non-immediate split per item against final rules authority.
// The Sword of mana split follows explicit direction; other seeded splits are editable in Item Maker.
export const DEFAULT_ITEM_LIBRARY: ItemTemplate[] = [
  {
    id: "item_light_steps",
    name: "Light steps",
    type: "Light Armour",
    rank: "C+",
    weight: "15LBS",
    value: "10,000CP",
    immediateEffects: "10% damage resistance; gives the user advantage on stealth checks.",
    nonImmediateEffects: "",
    updatedAt: REFERENCE_SEED_UPDATED_AT
  },
  {
    id: "item_never_dulls",
    name: "Never dulls",
    type: "Sword",
    rank: "D",
    weight: "3LBS",
    value: "500CP",
    immediateEffects: "Does 15 damage.",
    nonImmediateEffects: "This sword is always sharp and never dulls.",
    updatedAt: REFERENCE_SEED_UPDATED_AT
  },
  {
    id: "item_fire_shard",
    name: "Fire shard",
    type: "Shard of fire",
    rank: "A",
    weight: ".1 LBS",
    value: "1,000,000CP",
    immediateEffects: "Gives the player a fire attribute; +10 fire damage on fire-attribute attacks.",
    nonImmediateEffects: "",
    updatedAt: REFERENCE_SEED_UPDATED_AT
  },
  {
    id: "item_helm_of_sight",
    name: "Helm of sight",
    type: "helment",
    rank: "C",
    weight: "2LBS",
    value: "5,000CP",
    immediateEffects: "+2 to perception.",
    nonImmediateEffects: "",
    updatedAt: REFERENCE_SEED_UPDATED_AT
  },
  {
    id: "item_pyromancy_robe",
    name: "Pyromancy Robe",
    type: "Armour",
    rank: "B",
    weight: "1LBS",
    value: "100,000CP",
    immediateEffects: "25% resistance to fire; 10% resistance to magic.",
    nonImmediateEffects: "",
    updatedAt: REFERENCE_SEED_UPDATED_AT
  },
  {
    id: "item_sword_of_mana",
    name: "Sword of mana",
    type: "Sword",
    rank: "S",
    weight: "3LBS",
    value: "NA",
    immediateEffects: "25% increased mana regen.",
    nonImmediateEffects:
      "Conducts mana at 100% efficiency; +50 to all effects added to the sword (enchanting scope).",
    updatedAt: REFERENCE_SEED_UPDATED_AT
  }
];
