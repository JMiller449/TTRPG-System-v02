import { describe, expect, it } from "vitest";
import type { ServerEvent } from "@/domain/ipc";
import { createDefaultStats } from "@/features/sheets/templateEditorValues";
import { MockGameTransport } from "@/infrastructure/transport/MockGameTransport";
import type { SheetDefinitionPayload } from "@/infrastructure/ws/requestBuilders";

type SnapshotEvent = Extract<ServerEvent, { type: "snapshot" }>;

function collectEvents(transport: MockGameTransport): ServerEvent[] {
  const events: ServerEvent[] = [];
  transport.onEvent((event) => {
    events.push(event);
  });
  return events;
}

function latestSnapshot(events: ServerEvent[]): SnapshotEvent {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type === "snapshot") {
      return event;
    }
  }
  throw new Error("Expected a snapshot event");
}

function sheetDefinition(overrides: Partial<SheetDefinitionPayload> = {}): SheetDefinitionPayload {
  return {
    id: "template_created",
    name: "Created Template",
    notes: "GM notes",
    xp_given_when_slayed: 15,
    stats: {
      ...createDefaultStats(),
      strength: 12,
      constitution: 9,
      arcane: 4
    },
    ...overrides
  };
}

describe("MockGameTransport protocol sheet requests", () => {
  it("authenticates with explicit local development auth tokens", () => {
    const transport = new MockGameTransport();
    const events = collectEvents(transport);

    transport.sendProtocolRequest({
      request_id: "req-player",
      type: "authenticate",
      token: "player"
    });
    transport.sendProtocolRequest({
      request_id: "req-gm",
      type: "authenticate",
      token: "dm"
    });

    expect(events).toContainEqual({
      type: "authenticated",
      authenticated: true,
      role: "player",
      requestId: "req-player"
    });
    expect(events).toContainEqual({
      type: "authenticated",
      authenticated: true,
      role: "gm",
      requestId: "req-gm"
    });
  });

  it("reports Roll20 bridge status through protocol-shaped events", () => {
    const transport = new MockGameTransport();
    const events = collectEvents(transport);

    transport.sendProtocolRequest({
      request_id: "req-status",
      type: "get_roll20_bridge_status"
    });

    expect(events).toContainEqual({
      type: "roll20_bridge_status",
      connected: false,
      requestId: "req-status"
    });
  });

  it("reconciles typed sheet creation through snapshot and ack events", () => {
    const transport = new MockGameTransport();
    const events = collectEvents(transport);

    transport.sendProtocolRequest({
      request_id: "req-create-sheet",
      type: "create_sheet",
      sheet: sheetDefinition({
        dm_only: true,
        xp_cap: "50"
      })
    });

    const snapshot = latestSnapshot(events);
    const created = snapshot.snapshot.sheets.find((sheet) => sheet.id === "template_created");

    expect(snapshot.incremental).toBe(true);
    expect(created).toMatchObject({
      id: "template_created",
      name: "Created Template",
      notes: "GM notes",
      dm_only: true,
      xp_given_when_slayed: 15,
      xp_cap: "50",
      proficiencies: {},
      items: {},
      slayed_record: {},
      actions: {}
    });
    expect(events).toContainEqual({ type: "ack", requestId: "req-create-sheet" });
  });

  it("reconciles typed sheet updates against an existing template", () => {
    const transport = new MockGameTransport();
    const events = collectEvents(transport);

    transport.sendProtocolRequest({
      request_id: "req-update-sheet",
      type: "update_sheet",
      sheet_id: "template_goblin",
      sheet: sheetDefinition({
        id: "template_goblin",
        name: "Edited Goblin",
        notes: "Updated enemy notes",
        dm_only: true,
        xp_given_when_slayed: 25,
        stats: {
          ...createDefaultStats(),
          strength: 8,
          dexterity: 11,
          constitution: 6
        }
      })
    });

    const snapshot = latestSnapshot(events);
    const updated = snapshot.snapshot.sheets.find((sheet) => sheet.id === "template_goblin");

    expect(updated).toMatchObject({
      id: "template_goblin",
      name: "Edited Goblin",
      notes: "Updated enemy notes",
      dm_only: true,
      xp_given_when_slayed: 25
    });
    expect(updated?.stats).toMatchObject({
      strength: 8,
      dexterity: 11,
      constitution: 6
    });
    expect(events).toContainEqual({ type: "ack", requestId: "req-update-sheet" });
  });

  it("reconciles typed instanced sheet creation and selects the new instance", () => {
    const transport = new MockGameTransport();
    const events = collectEvents(transport);

    transport.sendProtocolRequest({
      request_id: "req-create-instance",
      type: "create_instanced_sheet",
      instance_id: "instance_spawned",
      parent_sheet_id: "template_player_base",
      health: 44,
      mana: 9,
      notes: "",
      generate_access_code: true
    });

    const snapshot = latestSnapshot(events);
    const instance = snapshot.snapshot.persistentSheets.find((sheet) => sheet.id === "instance_spawned");
    const presentation = snapshot.snapshot.persistentSheetPresentation.find(
      (entry) => entry.persistentSheetId === "instance_spawned"
    );

    expect(instance).toEqual({
      id: "instance_spawned",
      value: {
        parent_id: "template_player_base",
        health: 44,
        mana: 9,
        augments: {}
      }
    });
    expect(presentation?.value.name).toBe("Player Base");
    expect(events).toContainEqual({ type: "ack", requestId: "req-create-instance" });
  });

  it("emits explicit errors for typed requests unsupported by mock transport", () => {
    const transport = new MockGameTransport();
    const events = collectEvents(transport);

    transport.sendProtocolRequest({
      request_id: "req-delete-action",
      type: "delete_action",
      action_id: "action_missing"
    });

    expect(events).toContainEqual({
      type: "error",
      requestId: "req-delete-action",
      message: "delete_action is not supported by mock transport"
    });
  });
});
