import type { AppSnapshot, ClientIntent, PatchOp, ServerEvent } from "@/domain/ipc";
import type {
  EncounterPreset,
  RollLogEntry,
  SheetInstance,
  SheetTemplate
} from "@/domain/models";
import type { GameTransport, TransportUnsubscribe } from "@/infrastructure/transport/GameTransport";
import { makeId } from "@/shared/utils/id";

export class MockGameTransport implements GameTransport {
  public readonly mode = "mock" as const;

  private listeners = new Set<(event: ServerEvent) => void>();

  private snapshot: AppSnapshot = {
    templates: [
      {
        id: "template_player_base",
        kind: "player",
        mode: "template",
        name: "Player Base",
        notes: "Starter player sheet template",
        stats: { strength: 50, dexterity: 50, constitution: 50, perception: 50, arcane: 30, will: 40 },
        tags: ["starter"],
        updatedAt: new Date().toISOString()
      },
      {
        id: "template_goblin",
        kind: "enemy",
        mode: "template",
        name: "Goblin",
        notes: "Enemy template",
        stats: { strength: 25, dexterity: 35, constitution: 20, perception: 25, will: 10 },
        tags: ["enemy", "goblin"],
        updatedAt: new Date().toISOString()
      }
    ],
    instances: [
      {
        id: "instance_player_1",
        templateId: "template_player_base",
        kind: "player",
        mode: "instance",
        name: "Player One",
        notes: "Active character",
        updatedAt: new Date().toISOString()
      }
    ],
    encounters: [],
    rollLog: [],
    activeSheetId: "instance_player_1"
  };

  async connect(): Promise<void> {
    setTimeout(() => {
      this.emit({ type: "snapshot", snapshot: this.snapshot });
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
      case "create_template": {
        const template = {
          ...intent.payload.template,
          updatedAt: new Date().toISOString()
        };
        this.snapshot.templates = [template, ...this.snapshot.templates.filter((t) => t.id !== template.id)];
        this.emitPatch([{ op: "upsert_template", value: template }], intent.intentId);
        return;
      }
      case "update_template": {
        const existing = this.snapshot.templates.find((t) => t.id === intent.payload.templateId);
        if (!existing) {
          this.emit({
            type: "error",
            requestId: intent.intentId,
            message: "Template not found"
          });
          return;
        }
        const updated = {
          ...existing,
          ...intent.payload.changes,
          mode: "template" as const,
          updatedAt: new Date().toISOString()
        } satisfies SheetTemplate;
        this.snapshot.templates = this.snapshot.templates.map((template) =>
          template.id === updated.id ? updated : template
        );
        this.emitPatch([{ op: "upsert_template", value: updated }], intent.intentId);
        return;
      }
      case "instantiate_template": {
        const template = this.snapshot.templates.find((t) => t.id === intent.payload.templateId);
        if (!template) {
          this.emit({
            type: "error",
            requestId: intent.intentId,
            message: "Template not found"
          });
          return;
        }

        const ops: PatchOp[] = [];
        const amount = Math.max(1, intent.payload.count);
        for (let i = 0; i < amount; i += 1) {
          const instance: SheetInstance = {
            id: makeId("instance"),
            templateId: template.id,
            kind: template.kind,
            mode: "instance",
            name: amount > 1 ? `${template.name} ${i + 1}` : template.name,
            notes: template.notes,
            updatedAt: new Date().toISOString()
          };
          this.snapshot.instances = [instance, ...this.snapshot.instances];
          this.snapshot.activeSheetId = instance.id;
          ops.push({ op: "upsert_instance", value: instance });
          ops.push({ op: "set_active_sheet", value: { sheetId: instance.id } });
        }
        this.emitPatch(ops, intent.intentId);
        return;
      }
      case "save_encounter": {
        const encounter = {
          ...intent.payload.encounter,
          updatedAt: new Date().toISOString()
        } satisfies EncounterPreset;
        this.snapshot.encounters = [encounter, ...this.snapshot.encounters.filter((e) => e.id !== encounter.id)];
        this.emitPatch([{ op: "upsert_encounter", value: encounter }], intent.intentId);
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

        const ops: PatchOp[] = [];
        encounter.entries.forEach((entry) => {
          const template = this.snapshot.templates.find((templateItem) => templateItem.id === entry.templateId);
          if (!template) {
            return;
          }
          for (let i = 0; i < Math.max(1, entry.count); i += 1) {
            const instance: SheetInstance = {
              id: makeId("instance"),
              templateId: template.id,
              kind: template.kind,
              mode: "instance",
              name: entry.count > 1 ? `${template.name} ${i + 1}` : template.name,
              notes: template.notes,
              updatedAt: new Date().toISOString()
            };
            this.snapshot.instances = [instance, ...this.snapshot.instances];
            ops.push({ op: "upsert_instance", value: instance });
          }
        });

        this.emitPatch(ops, intent.intentId);
        return;
      }
      case "submit_roll": {
        const pendingEntry: RollLogEntry = {
          id: makeId("roll"),
          status: "resolved",
          request: intent.payload.request,
          createdAt: new Date().toISOString(),
          requestedByRole: intent.payload.requestedByRole,
          // TODO: replace with backend-calculated result once rules engine API is available.
          resultText: "Mock result only. Awaiting backend authoritative resolution."
        };
        this.snapshot.rollLog = [pendingEntry, ...this.snapshot.rollLog];
        this.emitPatch([{ op: "add_roll_log", value: pendingEntry }], intent.intentId);
        return;
      }
      case "set_active_sheet": {
        this.snapshot.activeSheetId = intent.payload.sheetId;
        this.emitPatch(
          [{ op: "set_active_sheet", value: { sheetId: intent.payload.sheetId } }],
          intent.intentId
        );
        return;
      }
      default: {
        const _exhaustive: never = intent;
        void _exhaustive;
      }
    }
  }

  onEvent(handler: (event: ServerEvent) => void): TransportUnsubscribe {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  private emitPatch(ops: PatchOp[], requestId: string): void {
    this.emit({ type: "patch", requestId, ops });
    this.emit({ type: "ack", requestId });
  }

  private emit(event: ServerEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }
}
