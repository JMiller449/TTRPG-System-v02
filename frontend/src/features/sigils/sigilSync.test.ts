import { describe, expect, it } from "vitest";
import {
  adaptProtocolServerEvent,
  initialSocketProtocolState
} from "@/infrastructure/ws/eventAdapters";
import { initialState } from "@/app/state/initialState";
import { reducer } from "@/app/state/reducer";
import { parseProtocolServerEvent } from "@/infrastructure/ws/protocol";

describe("authoritative sigil synchronization", () => {
  it("reconciles charge transitions and access revocation from snapshots and patches", () => {
    const sigil = {
      id: "sigil",
      owner_instance_id: "mage",
      revision: 0,
      nodes: [{ id: "root", name: "Inscription", diameter: 2, action_id: "spell", charge: null }]
    };
    const first = adaptProtocolServerEvent(initialSocketProtocolState, {
      type: "state_snapshot",
      response_id: null,
      state_version: 1,
      state: { sigils: { sigil } }
    });
    const snapshot = first.events.find((event) => event.type === "snapshot");
    if (!snapshot || snapshot.type !== "snapshot") throw new Error("Missing snapshot");
    let state = reducer(initialState, { type: "apply_snapshot", snapshot: snapshot.snapshot });
    expect(state.serverState.sigils.sigil.nodes[0].charge).toBeNull();
    const charged = adaptProtocolServerEvent(first.nextProtocolState, {
      type: "state_patch",
      response_id: null,
      state_version: 2,
      request_id: "charge",
      ops: [
        {
          op: "set",
          path: "/sigils/sigil/nodes/0/charge",
          value: {
            action_id: "spell",
            imbuer_instance_id: "mage",
            action_signature: "sig",
            mana_paid: 8
          }
        }
      ]
    });
    const chargedSnapshot = charged.events.find((event) => event.type === "snapshot");
    if (!chargedSnapshot || chargedSnapshot.type !== "snapshot")
      throw new Error("Missing snapshot");
    state = reducer(state, { type: "apply_snapshot", snapshot: chargedSnapshot.snapshot });
    expect(state.serverState.sigils.sigil.nodes[0].charge?.mana_paid).toBe(8);
    const revoked = adaptProtocolServerEvent(charged.nextProtocolState, {
      type: "state_patch",
      response_id: null,
      state_version: 3,
      ops: [{ op: "set", path: "/sigils", value: {} }]
    });
    const revokedSnapshot = revoked.events.find((event) => event.type === "snapshot");
    if (!revokedSnapshot || revokedSnapshot.type !== "snapshot")
      throw new Error("Missing snapshot");
    state = reducer(state, { type: "apply_snapshot", snapshot: revokedSnapshot.snapshot });
    expect(state.serverState.sigils).toEqual({});
  });

  it("validates preview values and emits a correlated completion", () => {
    const event = parseProtocolServerEvent({
      type: "sigil_preview",
      sigil_id: "sigil",
      node_id: "root",
      mana_cost: 8,
      multiplier: 2,
      request_id: "preview"
    });
    if (!event) throw new Error("Missing preview");
    expect(adaptProtocolServerEvent(initialSocketProtocolState, event).events).toContainEqual({
      type: "ack",
      requestId: "preview"
    });
    expect(parseProtocolServerEvent({ ...event, multiplier: Infinity })).toBeNull();
  });
});
