import type {
  ActionDefinition,
  EncounterPreset,
  FormulaDefinition,
  ItemDefinition,
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
  items: ItemDefinition[];
  actions: ActionDefinition[];
  formulas: FormulaDefinition[];
  sheetPresentation: SheetPresentationRecord[];
  persistentSheetPresentation: PersistentSheetPresentationRecord[];
  encounters: EncounterPreset[];
  rollLog: RollLogEntry[];
  activeSheetId: string | null;
}

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
  | { type: "authenticated"; authenticated: boolean; role: Role | null; requestId?: string; reason?: string }
  | { type: "snapshot"; snapshot: AppSnapshot; stateVersion?: number; incremental?: boolean }
  | { type: "ack"; requestId: string }
  | { type: "error"; requestId?: string; message: string };
