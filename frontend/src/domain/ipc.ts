import type {
  ActionDefinition,
  ActionHistoryEntry,
  ConditionPreset,
  EncounterPreset,
  FormulaDefinition,
  ItemDefinition,
  PersistentSheetPresentationRecord,
  PersistentSheetRecord,
  Role,
  Sheet,
  SheetPresentationRecord
} from "@/domain/models";
import type {
  ProtocolActionFormulaAuthoringMetadataEvent,
  ProtocolAugmentationTargetMetadataEvent
} from "@/infrastructure/ws/protocol";

export type ActionFormulaAuthoringMetadata = Omit<
  ProtocolActionFormulaAuthoringMetadataEvent,
  "response_id" | "request_id" | "type"
>;

export type AugmentationTargetMetadata = Omit<
  ProtocolAugmentationTargetMetadataEvent,
  "response_id" | "request_id" | "type"
>;

export interface AppSnapshot {
  sheets: Sheet[];
  persistentSheets: PersistentSheetRecord[];
  items: ItemDefinition[];
  actions: ActionDefinition[];
  formulas: FormulaDefinition[];
  conditionPresets: ConditionPreset[];
  sheetPresentation: SheetPresentationRecord[];
  persistentSheetPresentation: PersistentSheetPresentationRecord[];
  encounters: EncounterPreset[];
  actionHistory: ActionHistoryEntry[];
}

export type ServerEvent =
  | { type: "authenticated"; authenticated: boolean; role: Role | null; requestId?: string; reason?: string }
  | { type: "sheet_access_claimed"; sheetId: string; instanceId: string; requestId?: string }
  | { type: "action_formula_authoring_metadata"; metadata: ActionFormulaAuthoringMetadata; requestId?: string }
  | { type: "augmentation_target_metadata"; metadata: AugmentationTargetMetadata; requestId?: string }
  | { type: "roll20_bridge_status"; connected: boolean; requestId?: string }
  | { type: "snapshot"; snapshot: AppSnapshot; stateVersion?: number; incremental?: boolean; requestId?: string }
  | { type: "ack"; requestId: string }
  | { type: "sync_recovery"; requestId: string; lastSeenVersion: number | null; receivedVersion: number }
  | { type: "error"; requestId?: string; message: string };
