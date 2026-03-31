import type {
  EncounterPreset,
  PersistentSheetPresentation,
  PersistentSheetPresentationRecord,
  PersistentSheetRecord,
  Role,
  RollLogEntry,
  RollRequest,
  Sheet,
  SheetPresentation,
  SheetPresentationRecord
} from "@/domain/models";

export interface AppSnapshot {
  sheets: Sheet[];
  persistentSheets: PersistentSheetRecord[];
  sheetPresentation: SheetPresentationRecord[];
  persistentSheetPresentation: PersistentSheetPresentationRecord[];
  encounters: EncounterPreset[];
  rollLog: RollLogEntry[];
  activeSheetId: string | null;
}

export type PatchOp =
  | { op: "upsert_sheet"; value: Sheet }
  | { op: "remove_sheet"; value: { id: string } }
  | { op: "upsert_persistent_sheet"; value: PersistentSheetRecord }
  | { op: "remove_persistent_sheet"; value: { id: string } }
  | { op: "upsert_sheet_presentation"; value: { sheetId: string; presentation: SheetPresentation } }
  | {
      op: "upsert_persistent_sheet_presentation";
      value: { persistentSheetId: string; presentation: PersistentSheetPresentation };
    }
  | { op: "upsert_encounter"; value: EncounterPreset }
  | { op: "remove_encounter"; value: { id: string } }
  | { op: "set_active_sheet"; value: { sheetId: string | null } }
  | { op: "add_roll_log"; value: RollLogEntry }
  | { op: "update_roll_log"; value: Partial<RollLogEntry> & { id: string } };

export type ClientIntent =
  | {
      intentId: string;
      type: "authenticate_gm";
      payload: { password: string };
    }
  | {
      intentId: string;
      type: "create_sheet";
      payload: { sheet: Sheet; presentation?: SheetPresentation };
    }
  | {
      intentId: string;
      type: "update_sheet";
      payload: { sheetId: string; changes: Partial<Sheet>; presentation?: Partial<SheetPresentation> };
    }
  | {
      intentId: string;
      type: "instantiate_sheet";
      payload: { sheetId: string; count: number };
    }
  | {
      intentId: string;
      type: "save_encounter";
      payload: { encounter: EncounterPreset };
    }
  | {
      intentId: string;
      type: "spawn_encounter";
      payload: { encounterId: string };
    }
  | {
      intentId: string;
      type: "submit_roll";
      payload: { request: RollRequest; requestedByRole: Role };
    }
  | {
      intentId: string;
      type: "set_active_sheet";
      payload: { sheetId: string | null };
    };

export type ServerEvent =
  | { type: "snapshot"; snapshot: AppSnapshot }
  | { type: "patch"; requestId?: string; ops: PatchOp[] }
  | { type: "ack"; requestId: string }
  | { type: "error"; requestId?: string; message: string };
