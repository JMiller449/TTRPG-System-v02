import type {
  ActionDefinition,
  ActionHistoryEntry,
  ConditionPreset,
  EncounterPreset,
  FormulaDefinition,
  ItemDefinition,
  PersistentSheetRecord,
  ProficiencyDefinition,
  Role,
  Sheet
} from "@/domain/models";
import type {
  ProtocolActionFormulaAuthoringMetadataEvent,
  ProtocolAugmentationTargetMetadataEvent,
  ProtocolStateBackupExportedEvent,
  ProtocolXpTrackerEvent
} from "@/infrastructure/ws/protocol";

export type ActionFormulaAuthoringMetadata = Omit<
  ProtocolActionFormulaAuthoringMetadataEvent,
  "response_id" | "request_id" | "type"
>;

export type AugmentationTargetMetadata = Omit<
  ProtocolAugmentationTargetMetadataEvent,
  "response_id" | "request_id" | "type"
>;

export type XpTrackerView = Omit<
  ProtocolXpTrackerEvent,
  "response_id" | "request_id" | "type"
>;

export type StateBackupExport = Omit<
  ProtocolStateBackupExportedEvent,
  "response_id" | "request_id" | "type"
>;

export interface SheetAccessCode {
  code: string;
  sheetId: string;
  instanceId: string | null;
  active: boolean;
}
export interface AppSnapshot {
  sheets: Sheet[];
  persistentSheets: PersistentSheetRecord[];
  items: ItemDefinition[];
  proficiencies: ProficiencyDefinition[];
  actions: ActionDefinition[];
  formulas: FormulaDefinition[];
  conditionPresets: ConditionPreset[];
  encounters: EncounterPreset[];
  actionHistory: ActionHistoryEntry[];
}

export type ServerEvent =
  | { type: "authenticated"; authenticated: boolean; role: Role | null; requestId?: string; reason?: string }
  | { type: "sheet_access_claimed"; sheetId: string; instanceId: string; requestId?: string }
  | { type: "sheet_access_codes"; codes: SheetAccessCode[]; requestId?: string }
  | { type: "state_backup_exported"; backup: StateBackupExport; requestId?: string }
  | { type: "action_formula_authoring_metadata"; metadata: ActionFormulaAuthoringMetadata; requestId?: string }
  | { type: "augmentation_target_metadata"; metadata: AugmentationTargetMetadata; requestId?: string }
  | { type: "xp_tracker"; tracker: XpTrackerView; requestId?: string }
  | { type: "roll20_bridge_status"; connected: boolean; requestId?: string }
  | { type: "snapshot"; snapshot: AppSnapshot; stateVersion?: number; incremental?: boolean; requestId?: string }
  | { type: "ack"; requestId: string }
  | { type: "sync_recovery"; requestId: string; lastSeenVersion: number | null; receivedVersion: number }
  | { type: "connection_lost"; message: string }
  | { type: "error"; requestId?: string; message: string };
