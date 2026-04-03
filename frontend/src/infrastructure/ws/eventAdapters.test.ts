import { describe, expect, it } from "vitest";
import {
  adaptProtocolServerEvent,
  initialSocketProtocolState
} from "@/infrastructure/ws/eventAdapters";
import { parseProtocolServerEvent } from "@/infrastructure/ws/protocol";

describe("parseProtocolServerEvent", () => {
  it("parses authenticate responses from the backend protocol", () => {
    const event = parseProtocolServerEvent({
      response_id: null,
      authenticated: true,
      role: "dm",
      reason: null,
      type: "authenticate_response",
      request_id: "req-1"
    });

    expect(event).toEqual({
      response_id: null,
      authenticated: true,
      role: "dm",
      reason: null,
      type: "authenticate_response",
      request_id: "req-1"
    });
  });

  it("rejects unknown payloads", () => {
    expect(parseProtocolServerEvent({ type: "mystery_event" })).toBeNull();
  });
});

describe("adaptProtocolServerEvent", () => {
  it("maps authenticate responses into internal auth events", () => {
    const protocolEvent = parseProtocolServerEvent({
      response_id: null,
      authenticated: true,
      role: "player",
      reason: null,
      type: "authenticate_response",
      request_id: "req-2"
    });

    if (!protocolEvent || protocolEvent.type !== "authenticate_response") {
      throw new Error("Expected authenticate_response event");
    }

    const adapted = adaptProtocolServerEvent(initialSocketProtocolState, protocolEvent);

    expect(adapted.events).toEqual([
      {
        type: "authenticated",
        authenticated: true,
        role: "player",
        requestId: "req-2",
        reason: undefined
      }
    ]);
  });

  it("projects backend snapshots into the current app snapshot shape", () => {
    const protocolEvent = parseProtocolServerEvent({
      response_id: null,
      state: {
        sheets: {
          sheet_1: {
            id: "sheet_1",
            name: "Mage",
            dm_only: false,
            xp_given_when_slayed: 0,
            xp_cap: "",
            proficiencies: {},
            items: {},
            stats: {
              strength: 1,
              dexterity: 2,
              constitution: 3,
              perception: 4,
              arcane: 5,
              will: 6,
              lifting: { aliases: [], text: "1" },
              carry_weight: { aliases: [], text: "1" },
              acrobatics: { aliases: [], text: "1" },
              stamina: { aliases: [], text: "1" },
              reaction_time: { aliases: [], text: "1" },
              health: { aliases: [], text: "10" },
              endurance: { aliases: [], text: "1" },
              pain_tolerance: { aliases: [], text: "1" },
              sight_distance: { aliases: [], text: "1" },
              intuition: { aliases: [], text: "1" },
              registration: { aliases: [], text: "1" },
              mana: { aliases: [], text: "8" },
              control: { aliases: [], text: "1" },
              sensitivity: { aliases: [], text: "1" },
              charisma: { aliases: [], text: "1" },
              mental_fortitude: { aliases: [], text: "1" },
              courage: { aliases: [], text: "1" }
            },
            slayed_record: {},
            actions: {}
          }
        },
        instanced_sheets: {
          instance_1: {
            parent_id: "sheet_1",
            health: 10,
            mana: 8,
            augments: {}
          }
        },
        formulas: {},
        actions: {},
        items: {},
        proficiencies: {}
      },
      state_version: 0,
      type: "state_snapshot",
      request_id: null
    });

    if (!protocolEvent || protocolEvent.type !== "state_snapshot") {
      throw new Error("Expected state_snapshot event");
    }

    const adapted = adaptProtocolServerEvent(initialSocketProtocolState, protocolEvent);

    expect(adapted.events).toEqual([
      {
        type: "snapshot",
        stateVersion: 0,
        incremental: false,
        snapshot: {
          sheets: [protocolEvent.state.sheets?.sheet_1],
          persistentSheets: [
            {
              id: "instance_1",
              value: protocolEvent.state.instanced_sheets?.instance_1
            }
          ],
          items: [],
          actions: [],
          formulas: [],
          sheetPresentation: [],
          persistentSheetPresentation: [],
          encounters: [],
          rollLog: [],
          activeSheetId: null
        }
      }
    ]);
  });

  it("applies backend patches against the last authoritative snapshot", () => {
    const snapshotEvent = parseProtocolServerEvent({
      response_id: null,
      state: {
        sheets: {},
        instanced_sheets: {},
        formulas: {},
        actions: {},
        items: {},
        proficiencies: {}
      },
      state_version: 0,
      type: "state_snapshot",
      request_id: null
    });

    if (!snapshotEvent || snapshotEvent.type !== "state_snapshot") {
      throw new Error("Expected state_snapshot event");
    }

    const afterSnapshot = adaptProtocolServerEvent(initialSocketProtocolState, snapshotEvent);
    const patchEvent = parseProtocolServerEvent({
      response_id: null,
      ops: [
        {
          op: "set",
          path: "/sheets/template_1",
          value: {
            id: "template_1",
            name: "Goblin",
            dm_only: true,
            xp_given_when_slayed: 10,
            xp_cap: "",
            proficiencies: {},
            items: {},
            stats: {
              strength: 1,
              dexterity: 1,
              constitution: 1,
              perception: 1,
              arcane: 1,
              will: 1,
              lifting: { aliases: [], text: "1" },
              carry_weight: { aliases: [], text: "1" },
              acrobatics: { aliases: [], text: "1" },
              stamina: { aliases: [], text: "1" },
              reaction_time: { aliases: [], text: "1" },
              health: { aliases: [], text: "1" },
              endurance: { aliases: [], text: "1" },
              pain_tolerance: { aliases: [], text: "1" },
              sight_distance: { aliases: [], text: "1" },
              intuition: { aliases: [], text: "1" },
              registration: { aliases: [], text: "1" },
              mana: { aliases: [], text: "1" },
              control: { aliases: [], text: "1" },
              sensitivity: { aliases: [], text: "1" },
              charisma: { aliases: [], text: "1" },
              mental_fortitude: { aliases: [], text: "1" },
              courage: { aliases: [], text: "1" }
            },
            slayed_record: {},
            actions: {}
          }
        }
      ],
      state_version: 1,
      type: "state_patch",
      request_id: "req-3"
    });

    if (!patchEvent || patchEvent.type !== "state_patch") {
      throw new Error("Expected state_patch event");
    }

    const adapted = adaptProtocolServerEvent(afterSnapshot.nextProtocolState, patchEvent);
    const snapshot = adapted.events[0];

    expect(snapshot?.type).toBe("snapshot");
    if (snapshot?.type !== "snapshot") {
      throw new Error("Expected snapshot event");
    }
    expect(snapshot.snapshot.sheets[0]?.id).toBe("template_1");
    expect(snapshot.snapshot.sheets[0]?.name).toBe("Goblin");
  });
});
