import type { AppSnapshot, ClientIntent, ServerEvent } from "@/domain/ipc";
import type {
  EncounterPreset,
  PersistentSheet,
  PersistentSheetPresentation,
  PersistentSheetRecord,
  Sheet
} from "@/domain/models";
import type { GameTransport, TransportUnsubscribe } from "@/infrastructure/transport/GameTransport";
import type { ProtocolApplicationRequest } from "@/infrastructure/ws/protocol";
import { createDefaultStats } from "@/features/sheets/templateEditorValues";
import { makeId } from "@/shared/utils/id";

function now(): string {
  return new Date().toISOString();
}

function createPersistentSheet(parent_id: string, health: number, mana: number): PersistentSheet {
  return {
    parent_id,
    health,
    mana,
    augments: {}
  };
}

type SheetDefinitionRequest = Extract<ProtocolApplicationRequest, { type: "create_sheet" | "update_sheet" }>;

function createSheetFromDefinition(sheet: SheetDefinitionRequest["sheet"]): Sheet {
  return {
    id: sheet.id,
    name: sheet.name,
    notes: sheet.notes,
    dm_only: sheet.dm_only ?? false,
    xp_given_when_slayed: sheet.xp_given_when_slayed,
    xp_cap: sheet.xp_cap ?? "",
    proficiencies: sheet.proficiencies ?? {},
    items: sheet.items ?? {},
    stats: sheet.stats,
    slayed_record: sheet.slayed_record ?? {},
    actions: sheet.actions ?? {}
  };
}

export class MockGameTransport implements GameTransport {
  public readonly mode = "mock" as const;

  private listeners = new Set<(event: ServerEvent) => void>();
  private stateVersion = 0;

  private snapshot: AppSnapshot = {
    sheets: [
      {
        id: "template_player_base",
        name: "Player Base",
        dm_only: false,
        xp_given_when_slayed: 0,
        xp_cap: "",
        proficiencies: {},
        items: {},
        stats: {
          ...createDefaultStats(),
          strength: 50,
          dexterity: 50,
          constitution: 50,
          perception: 50,
          arcane: 30,
          will: 40
        },
        slayed_record: {},
        actions: {}
      },
      {
        id: "template_goblin",
        name: "Goblin",
        dm_only: true,
        xp_given_when_slayed: 10,
        xp_cap: "",
        proficiencies: {},
        items: {},
        stats: {
          ...createDefaultStats(),
          strength: 25,
          dexterity: 35,
          constitution: 20,
          perception: 25,
          arcane: 0,
          will: 10
        },
        slayed_record: {},
        actions: {}
      }
    ],
    persistentSheets: [
      {
        id: "instance_player_1",
        value: createPersistentSheet("template_player_base", 50, 30)
      }
    ],
    items: [],
    actions: [],
    formulas: [],
    conditionPresets: [],
    sheetPresentation: [
      {
        sheetId: "template_player_base",
        value: {
          kind: "player",
          notes: "Starter player sheet template",
          tags: ["starter"],
          updatedAt: now()
        }
      },
      {
        sheetId: "template_goblin",
        value: {
          kind: "enemy",
          notes: "Enemy template",
          tags: ["enemy", "goblin"],
          updatedAt: now()
        }
      }
    ],
    persistentSheetPresentation: [
      {
        persistentSheetId: "instance_player_1",
        value: {
          name: "Player One",
          updatedAt: now()
        }
      }
    ],
    encounters: [],
    actionHistory: [],
    activeSheetId: "instance_player_1"
  };

  async connect(): Promise<void> {
    setTimeout(() => {
      this.emit({ type: "snapshot", snapshot: this.snapshot, stateVersion: this.stateVersion });
    }, 120);
  }

  disconnect(): void {
    this.emit({ type: "error", message: "Mock transport disconnected" });
  }

  sendIntent(intent: ClientIntent): void {
    switch (intent.type) {
      case "authenticate_gm": {
        const accepted = intent.payload.password.length > 0;
        if (!accepted) {
          this.emit({
            type: "error",
            requestId: intent.intentId,
            message: "GM password cannot be empty"
          });
          return;
        }
        this.emit({ type: "ack", requestId: intent.intentId });
        return;
      }
      case "save_encounter": {
        const encounter = {
          ...intent.payload.encounter,
          updatedAt: now()
        } satisfies EncounterPreset;
        this.snapshot.encounters = [encounter, ...this.snapshot.encounters.filter((e) => e.id !== encounter.id)];
        this.emitIncrementalSnapshot(intent.intentId);
        return;
      }
      case "spawn_encounter": {
        const encounter = this.snapshot.encounters.find((entry) => entry.id === intent.payload.encounterId);
        if (!encounter) {
          this.emit({
            type: "error",
            requestId: intent.intentId,
            message: "Encounter not found"
          });
          return;
        }

        encounter.entries.forEach((entry) => {
          const sheet = this.snapshot.sheets.find((sheetItem) => sheetItem.id === entry.templateId);
          if (!sheet) {
            return;
          }
          for (let i = 0; i < Math.max(1, entry.count); i += 1) {
            const record = this.createPersistentSheetRecord(sheet.id, sheet.name, entry.count > 1 ? i + 1 : null);
            this.snapshot.persistentSheets = [record, ...this.snapshot.persistentSheets];
            this.upsertPersistentSheetPresentation(record.id, {
              name: entry.count > 1 ? `${sheet.name} ${i + 1}` : sheet.name,
              updatedAt: now()
            });
          }
        });

        this.emitIncrementalSnapshot(intent.intentId);
        return;
      }
      case "submit_roll": {
        this.emitIncrementalSnapshot(intent.intentId);
        return;
      }
      case "set_active_sheet": {
        this.snapshot.activeSheetId = intent.payload.sheetId;
        this.emitIncrementalSnapshot(intent.intentId);
        return;
      }
      default: {
        const _exhaustive: never = intent;
        void _exhaustive;
      }
    }
  }

  sendProtocolRequest(request: ProtocolApplicationRequest): void {
    switch (request.type) {
      case "authenticate": {
        const role = request.token === "change-me-dm-code" ? "gm" : request.token === "change-me-player-code" ? "player" : null;
        if (!role) {
          this.emit({
            type: "authenticated",
            authenticated: false,
            role: null,
            requestId: request.request_id ?? undefined,
            reason: "Invalid player or DM code."
          });
          return;
        }
        this.emit({
          type: "authenticated",
          authenticated: true,
          role,
          requestId: request.request_id ?? undefined
        });
        this.emit({ type: "snapshot", snapshot: this.snapshot, stateVersion: this.stateVersion });
        return;
      }
      case "resync_state":
        this.emit({ type: "snapshot", snapshot: this.snapshot, stateVersion: this.stateVersion });
        return;
      case "get_roll20_bridge_status":
        this.emit({
          type: "roll20_bridge_status",
          connected: false,
          requestId: request.request_id ?? undefined
        });
        return;
      case "create_sheet": {
        const sheet = createSheetFromDefinition(request.sheet);
        this.snapshot.sheets = [sheet, ...this.snapshot.sheets.filter((entry) => entry.id !== sheet.id)];
        this.emitIncrementalSnapshot(request.request_id ?? makeId("request"));
        return;
      }
      case "update_sheet": {
        const existing = this.snapshot.sheets.find((entry) => entry.id === request.sheet_id);
        if (!existing) {
          this.emit({
            type: "error",
            requestId: request.request_id ?? undefined,
            message: "Sheet not found"
          });
          return;
        }
        const updated = createSheetFromDefinition(request.sheet);
        this.snapshot.sheets = this.snapshot.sheets.map((entry) =>
          entry.id === request.sheet_id ? updated : entry
        );
        this.emitIncrementalSnapshot(request.request_id ?? makeId("request"));
        return;
      }
      case "delete_sheet": {
        this.snapshot.sheets = this.snapshot.sheets.filter((entry) => entry.id !== request.sheet_id);
        this.snapshot.persistentSheets = this.snapshot.persistentSheets.filter(
          (entry) => entry.value.parent_id !== request.sheet_id
        );
        this.emitIncrementalSnapshot(request.request_id ?? makeId("request"));
        return;
      }
      case "create_instanced_sheet": {
        const parentSheet = this.snapshot.sheets.find((entry) => entry.id === request.parent_sheet_id);
        if (!parentSheet) {
          this.emit({
            type: "error",
            requestId: request.request_id ?? undefined,
            message: "Sheet not found"
          });
          return;
        }
        if (this.snapshot.persistentSheets.some((entry) => entry.id === request.instance_id)) {
          this.emit({
            type: "error",
            requestId: request.request_id ?? undefined,
            message: "Instance already exists"
          });
          return;
        }
        this.snapshot.persistentSheets = [
          {
            id: request.instance_id,
            value: createPersistentSheet(request.parent_sheet_id, request.health, request.mana)
          },
          ...this.snapshot.persistentSheets
        ];
        this.snapshot.activeSheetId = request.instance_id;
        this.upsertPersistentSheetPresentation(request.instance_id, {
          name: parentSheet.name,
          updatedAt: now()
        });
        this.emitIncrementalSnapshot(request.request_id ?? makeId("request"));
        return;
      }
      case "claim_sheet_access_code": {
        const firstPlayerInstance = this.snapshot.persistentSheets.find((record) => {
          const parentSheet = this.snapshot.sheets.find((sheet) => sheet.id === record.value.parent_id);
          return parentSheet && !parentSheet.dm_only;
        });
        if (!firstPlayerInstance) {
          this.emit({
            type: "error",
            requestId: request.request_id ?? undefined,
            message: "No mock player sheet is available."
          });
          return;
        }
        this.emit({
          type: "sheet_access_claimed",
          sheetId: firstPlayerInstance.value.parent_id,
          instanceId: firstPlayerInstance.id,
          requestId: request.request_id ?? undefined
        });
        return;
      }
      case "perform_action":
        this.emit({ type: "ack", requestId: request.request_id ?? makeId("request") });
        return;
      default:
        this.emit({
          type: "error",
          requestId: request.request_id ?? undefined,
          message: `${request.type} is not supported by mock transport`
        });
    }
  }

  onEvent(handler: (event: ServerEvent) => void): TransportUnsubscribe {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  private createPersistentSheetRecord(sheetId: string, name: string, index: number | null): PersistentSheetRecord {
    const id = makeId("instance");
    const baseSheet = this.snapshot.sheets.find((entry) => entry.id === sheetId);
    const health = baseSheet ? Number(baseSheet.stats.health.text) || baseSheet.stats.constitution : 0;
    const mana = baseSheet ? Number(baseSheet.stats.mana.text) || baseSheet.stats.arcane : 0;
    const record = {
      id,
      value: createPersistentSheet(sheetId, health, mana)
    } satisfies PersistentSheetRecord;

    this.upsertPersistentSheetPresentation(id, {
      name: index ? `${name} ${index}` : name,
      updatedAt: now()
    });

    return record;
  }

  private getPersistentSheetPresentation(persistentSheetId: string): PersistentSheetPresentation {
    return (
      this.snapshot.persistentSheetPresentation.find((entry) => entry.persistentSheetId === persistentSheetId)
        ?.value ?? { updatedAt: now() }
    );
  }

  private upsertPersistentSheetPresentation(
    persistentSheetId: string,
    presentation: PersistentSheetPresentation
  ): void {
    this.snapshot.persistentSheetPresentation = [
      { persistentSheetId, value: presentation },
      ...this.snapshot.persistentSheetPresentation.filter((entry) => entry.persistentSheetId !== persistentSheetId)
    ];
  }

  private emitIncrementalSnapshot(requestId: string): void {
    this.stateVersion += 1;
    this.emit({
      type: "snapshot",
      snapshot: this.snapshot,
      stateVersion: this.stateVersion,
      incremental: true
    });
    this.emit({ type: "ack", requestId });
  }

  private emit(event: ServerEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }
}
