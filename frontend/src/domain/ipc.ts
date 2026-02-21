import type {
  EncounterPreset,
  Role,
  RollLogEntry,
  RollRequest,
  SheetInstance,
  SheetTemplate
} from "@/domain/models";

export interface AppSnapshot {
  templates: SheetTemplate[];
  instances: SheetInstance[];
  encounters: EncounterPreset[];
  rollLog: RollLogEntry[];
  activeSheetId: string | null;
}

export type PatchOp =
  | { op: "upsert_template"; value: SheetTemplate }
  | { op: "remove_template"; value: { id: string } }
  | { op: "upsert_instance"; value: SheetInstance }
  | { op: "remove_instance"; value: { id: string } }
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
      type: "create_template";
      payload: { template: SheetTemplate };
    }
  | {
      intentId: string;
      type: "update_template";
      payload: { templateId: string; changes: Partial<SheetTemplate> };
    }
  | {
      intentId: string;
      type: "instantiate_template";
      payload: { templateId: string; count: number };
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
