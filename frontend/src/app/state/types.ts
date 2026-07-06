import type {
  ActionFormulaAuthoringMetadata,
  AppSnapshot,
  AugmentationTargetMetadata,
  SheetAccessCode,
  StateBackupExport,
  XpTrackerView
} from "@/domain/ipc";
import type {
  ActionDefinition,
  ActionHistoryEntry,
  ActiveCondition,
  Augmentation,
  ConditionPreset,
  EncounterPreset,
  AttributeDefinition,
  FormulaDefinition,
  ItemDefinition,
  PersistentSheet,
  ProficiencyDefinition,
  Role,
  Sheet,
  StandaloneEffectApplication,
  StandaloneEffectDefinition
} from "@/domain/models";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";
export type IntentFeedbackStatus = "pending" | "success" | "error";
export type Roll20BridgeConnectionStatus = "unknown" | "connected" | "disconnected";
export type GMView =
  | "console"
  | "sheet_viewer"
  | "action_history"
  | "template_library"
  | "create_template"
  | "encounter_presets"
  | "item_maker"
  | "formula_authoring"
  | "attribute_authoring"
  | "proficiency_authoring"
  | "condition_authoring"
  | "effect_authoring"
  | "action_authoring"
  | "xp_tracker"
  | "state_backup"
  | "extension";

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
  proficiencies: Record<string, ProficiencyDefinition>;
  proficiencyOrder: string[];
  actions: Record<string, ActionDefinition>;
  actionOrder: string[];
  formulas: Record<string, FormulaDefinition>;
  formulaOrder: string[];
  attributes: Record<string, AttributeDefinition>;
  attributeOrder: string[];
  augmentations: Record<string, Augmentation>;
  augmentationOrder: string[];
  standaloneEffects: Record<string, StandaloneEffectDefinition>;
  standaloneEffectOrder: string[];
  standaloneEffectApplications: Record<string, StandaloneEffectApplication>;
  standaloneEffectApplicationOrder: string[];
  conditionPresets: Record<string, ConditionPreset>;
  conditionPresetOrder: string[];
  activeConditions: Record<string, ActiveCondition>;
  activeConditionOrder: string[];
  encounters: Record<string, EncounterPreset>;
  encounterOrder: string[];
  actionHistory: Record<string, ActionHistoryEntry>;
  actionHistoryOrder: string[];
}

export interface UIState {
  playerSheetSelectionComplete: boolean;
  connection: {
    status: ConnectionStatus;
    error?: string;
  };
  roll20Bridge: {
    status: Roll20BridgeConnectionStatus;
    lastCheckedAt?: string;
    lastError?: string;
  };
  gmView: GMView;
  activeSheetId: string | null;
  templateBuilderSheetId: string | null;
  templateSearch: string;
  pendingIntentIds: string[];
  intentFeedback: IntentFeedbackItem[];
  actionFormulaAuthoringMetadata: ActionFormulaAuthoringMetadata | null;
  augmentationTargetMetadata: AugmentationTargetMetadata | null;
  xpTracker: XpTrackerView | null;
  sheetAccessCodes: SheetAccessCode[];
  stateBackupExport: StateBackupExport | null;
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
  | { type: "set_template_builder_sheet"; sheetId: string | null }
  | { type: "set_template_search"; value: string }
  | { type: "reset_session_ui" }
  | { type: "connection_status"; status: ConnectionStatus }
  | { type: "connection_error"; error?: string }
  | { type: "clear_connection_error_matching"; text: string }
  | {
      type: "set_roll20_bridge_status";
      status: Roll20BridgeConnectionStatus;
      checkedAt?: string;
      error?: string;
    }
  | { type: "queue_intent"; intentId: string }
  | { type: "clear_intent"; intentId: string }
  | { type: "push_intent_feedback"; item: IntentFeedbackItem }
  | { type: "dismiss_intent_feedback"; id: string }
  | { type: "set_action_formula_authoring_metadata"; metadata: ActionFormulaAuthoringMetadata }
  | { type: "set_augmentation_target_metadata"; metadata: AugmentationTargetMetadata }
  | { type: "set_xp_tracker"; tracker: XpTrackerView }
  | { type: "set_sheet_access_codes"; codes: SheetAccessCode[] }
  | { type: "set_state_backup_export"; backup: StateBackupExport | null }
  | { type: "apply_snapshot"; snapshot: AppSnapshot };
