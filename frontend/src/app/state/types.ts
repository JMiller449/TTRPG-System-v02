import type { ActionFormulaAuthoringMetadata, AppSnapshot } from "@/domain/ipc";
import type {
  ActionDefinition,
  EncounterPreset,
  FormulaDefinition,
  ItemDefinition,
  PersistentSheet,
  PersistentSheetPresentation,
  Role,
  Sheet,
  SheetPresentation,
  StatKey,
} from "@/domain/models";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";
export type IntentFeedbackStatus = "pending" | "success" | "error";
export type GMView =
  | "console"
  | "template_library"
  | "create_template"
  | "encounter_presets"
  | "item_maker"
  | "formula_authoring"
  | "action_authoring";

export interface IntentFeedbackItem {
  id: string;
  intentId?: string;
  status: IntentFeedbackStatus;
  message: string;
  createdAt: string;
}

export interface ServerState {
  role: Role | null;
  gmAuthenticated: boolean;
  sheets: Record<string, Sheet>;
  sheetOrder: string[];
  persistentSheets: Record<string, PersistentSheet>;
  persistentSheetOrder: string[];
  items: Record<string, ItemDefinition>;
  itemOrder: string[];
  actions: Record<string, ActionDefinition>;
  actionOrder: string[];
  formulas: Record<string, FormulaDefinition>;
  formulaOrder: string[];
  sheetPresentation: Record<string, SheetPresentation>;
  persistentSheetPresentation: Record<string, PersistentSheetPresentation>;
  encounters: Record<string, EncounterPreset>;
  encounterOrder: string[];
}

export interface UIState {
  playerSheetSelectionComplete: boolean;
  connection: {
    status: ConnectionStatus;
    transport: "mock" | "ws";
    error?: string;
  };
  gmView: GMView;
  activeSheetId: string | null;
  templateSearch: string;
  pendingIntentIds: string[];
  intentFeedback: IntentFeedbackItem[];
  actionFormulaAuthoringMetadata: ActionFormulaAuthoringMetadata | null;
  localSheetNotes: Record<string, string>;
  localSheetStatOverrides: Record<string, Partial<Record<StatKey, number>>>;
}

export interface AppState {
  serverState: ServerState;
  uiState: UIState;
}

export type AppAction =
  | { type: "set_role"; role: Role | null }
  | { type: "set_player_sheet_selection_complete"; value: boolean }
  | { type: "set_gm_authenticated"; value: boolean }
  | { type: "set_gm_view"; view: GMView }
  | { type: "set_active_sheet_local"; sheetId: string | null }
  | { type: "set_template_search"; value: string }
  | { type: "reset_session_ui" }
  | { type: "connection_status"; status: ConnectionStatus }
  | { type: "connection_transport"; transport: "mock" | "ws" }
  | { type: "connection_error"; error?: string }
  | { type: "queue_intent"; intentId: string }
  | { type: "clear_intent"; intentId: string }
  | { type: "push_intent_feedback"; item: IntentFeedbackItem }
  | { type: "dismiss_intent_feedback"; id: string }
  | { type: "set_action_formula_authoring_metadata"; metadata: ActionFormulaAuthoringMetadata }
  | { type: "set_sheet_note"; sheetId: string; note: string }
  | { type: "set_sheet_stat_overrides"; sheetId: string; overrides: Partial<Record<StatKey, number>> }
  | { type: "clear_sheet_stat_overrides"; sheetId: string }
  | { type: "apply_snapshot"; snapshot: AppSnapshot };
