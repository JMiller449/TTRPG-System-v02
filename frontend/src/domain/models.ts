export type Role = "player" | "gm";

export type SheetKind = "player" | "enemy";
export type SheetMode = "template" | "instance";

export type StatKey =
  | "strength"
  | "dexterity"
  | "constitution"
  | "perception"
  | "arcane"
  | "will"
  | "lifting"
  | "carry_weight"
  | "acrobatics"
  | "stamina"
  | "reaction_time"
  | "health"
  | "endurance"
  | "pain_tolerance"
  | "sight_distance"
  | "intuition"
  | "registration"
  | "mana"
  | "control"
  | "sensitivity"
  | "charisma"
  | "mental_fortitude"
  | "courage";

export interface SheetTemplate {
  id: string;
  kind: SheetKind;
  mode: "template";
  name: string;
  notes: string;
  stats: Partial<Record<StatKey, number>>;
  tags: string[];
  updatedAt: string;
}

export interface SheetInstance {
  id: string;
  templateId: string;
  kind: SheetKind;
  mode: "instance";
  name: string;
  notes: string;
  updatedAt: string;
}

export interface EncounterEntry {
  templateId: string;
  count: number;
}

export interface EncounterPreset {
  id: string;
  name: string;
  entries: EncounterEntry[];
  updatedAt: string;
}

export interface ItemTemplate {
  id: string;
  name: string;
  type: string;
  rank: string;
  weight: string;
  value: string;
  immediateEffects: string;
  nonImmediateEffects: string;
  updatedAt: string;
}

export interface SheetInventoryItem {
  id: string;
  itemTemplateId: string;
}

export type RollVisibility = "visible" | "hidden";

export interface RollRequest {
  sheetId: string;
  stat: StatKey;
  context: string;
  visibility: RollVisibility;
}

export type RollStatus = "pending" | "resolved" | "failed";

export interface RollLogEntry {
  id: string;
  status: RollStatus;
  request: RollRequest;
  createdAt: string;
  requestedByRole: Role;
  resultText?: string;
  error?: string;
}
