import type { ReactNode } from "react";

export type AsyncUiStatus = "idle" | "pending" | "success" | "error";
export type ResourceTone = "health" | "mana" | "action" | "reaction" | "neutral";
export type ConditionSeverity = "info" | "warning" | "danger";
export type SyncState = "offline" | "connecting" | "synced" | "pending" | "stale" | "error";

export interface SyncStatusViewModel {
  state: SyncState;
  label?: string;
  detail?: string;
}

export interface ResourceViewModel {
  id: string;
  label: string;
  value: number;
  max?: number;
  unit?: string;
  tone?: ResourceTone;
  status?: AsyncUiStatus;
  errorMessage?: string;
  onDecrease?: () => void | Promise<void>;
  onIncrease?: () => void | Promise<void>;
}

export interface CharacterHeroBarProps {
  name: string;
  eyebrow?: string;
  subtitle?: string;
  level?: number;
  portraitUrl?: string;
  badges?: string[];
  resources: ResourceViewModel[];
  syncStatus?: SyncStatusViewModel;
  actions?: ReactNode;
}

export interface SheetTabDefinition {
  id: string;
  label: string;
  badge?: number | string;
  disabled?: boolean;
}

export interface SubstatViewModel {
  id: string;
  label: string;
  value: number;
  modifier?: number;
  hint?: string;
  status?: AsyncUiStatus;
  onRoll?: () => void | Promise<void>;
}

export interface StatGroupViewModel {
  id: string;
  label: string;
  value: number;
  modifier?: number;
  hint?: string;
  status?: AsyncUiStatus;
  onRoll?: () => void | Promise<void>;
  substats: SubstatViewModel[];
}

export interface ActionViewModel {
  id: string;
  name: string;
  summary?: string;
  category: string;
  tags?: string[];
  cost?: string;
  rollLabel?: string;
  isFavorite?: boolean;
  pending?: boolean;
  disabledReason?: string;
  onPerform?: () => void | Promise<void>;
  onToggleFavorite?: () => void;
}

export interface ConditionViewModel {
  id: string;
  name: string;
  summary?: string;
  source?: string;
  duration?: string;
  severity?: ConditionSeverity;
  removable?: boolean;
  pending?: boolean;
  onRemove?: () => void | Promise<void>;
}

export interface QuickRollItem {
  id: string;
  label: string;
  shortLabel?: string;
  pending?: boolean;
  disabledReason?: string;
  onTrigger?: () => void | Promise<void>;
}

export interface CharacterSheetViewModel {
  hero: CharacterHeroBarProps;
  stats: StatGroupViewModel[];
  actions: ActionViewModel[];
  conditions: ConditionViewModel[];
  quickRolls?: QuickRollItem[];
}
