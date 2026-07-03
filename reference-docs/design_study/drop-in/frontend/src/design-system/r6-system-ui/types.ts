import type { ReactNode } from "react";

export type R6Tone = "default" | "health" | "mana" | "action" | "warning" | "danger" | "arcane" | "success";

export interface R6Stat {
  key: string;
  label: string;
  shortLabel: string;
  value: number | string;
  modifier?: number | string;
  glyph?: ReactNode;
  description?: string;
}

export interface R6Tab {
  id: string;
  label: string;
  badge?: number | string;
  disabled?: boolean;
}

export interface R6Action {
  id: string;
  name: string;
  category: string;
  governingStat?: string;
  cost?: string;
  formula?: string;
  description?: string;
  tags?: string[];
  disabledReason?: string;
}

export type R6Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface R6InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  equipped?: boolean;
  depleted?: boolean;
  rarity?: R6Rarity;
  description?: string;
  tags?: string[];
}
