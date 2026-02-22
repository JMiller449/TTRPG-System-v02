import type { AppSnapshot, PatchOp } from "@/domain/ipc";
import type {
  EncounterPreset,
  Role,
  RollLogEntry,
  StatKey,
  SheetInstance,
  SheetTemplate
} from "@/domain/models";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";
export type IntentFeedbackStatus = "pending" | "success" | "error";
export type GMView =
  | "console"
  | "template_library"
  | "create_template"
  | "encounter_presets";

export interface IntentFeedbackItem {
  id: string;
  intentId?: string;
  status: IntentFeedbackStatus;
  message: string;
  createdAt: string;
}

export interface AppState {
  role: Role | null;
  playerConsoleEnteredSheetId: string | null;
  gmPassword: string;
  gmAuthenticated: boolean;
  connection: {
    status: ConnectionStatus;
    transport: "mock" | "ws";
    error?: string;
  };
  gmView: GMView;
  templates: Record<string, SheetTemplate>;
  templateOrder: string[];
  instances: Record<string, SheetInstance>;
  instanceOrder: string[];
  encounters: Record<string, EncounterPreset>;
  encounterOrder: string[];
  rollLog: RollLogEntry[];
  activeSheetId: string | null;
  templateSearch: string;
  pendingIntentIds: string[];
  intentFeedback: IntentFeedbackItem[];
  localSheetNotes: Record<string, string>;
  localSheetEquipment: Record<string, string[]>;
  localSheetActiveWeapon: Record<string, string | null>;
  localSheetStatOverrides: Record<string, Partial<Record<StatKey, number>>>;
}

export type AppAction =
  | { type: "set_role"; role: Role | null }
  | { type: "set_player_console_entered_sheet"; sheetId: string | null }
  | { type: "set_gm_password"; password: string }
  | { type: "set_gm_authenticated"; value: boolean }
  | { type: "set_gm_view"; view: GMView }
  | { type: "set_template_search"; value: string }
  | { type: "connection_status"; status: ConnectionStatus }
  | { type: "connection_error"; error?: string }
  | { type: "queue_intent"; intentId: string }
  | { type: "clear_intent"; intentId: string }
  | { type: "push_intent_feedback"; item: IntentFeedbackItem }
  | { type: "dismiss_intent_feedback"; id: string }
  | { type: "set_sheet_note"; sheetId: string; note: string }
  | { type: "add_sheet_equipment"; sheetId: string; item: string }
  | { type: "remove_sheet_equipment"; sheetId: string; index: number }
  | { type: "set_sheet_active_weapon"; sheetId: string; item: string | null }
  | { type: "set_sheet_stat_overrides"; sheetId: string; overrides: Partial<Record<StatKey, number>> }
  | { type: "clear_sheet_stat_overrides"; sheetId: string }
  | { type: "apply_snapshot"; snapshot: AppSnapshot }
  | { type: "apply_patch"; ops: PatchOp[] }
  | { type: "optimistic_add_roll"; entry: RollLogEntry };
