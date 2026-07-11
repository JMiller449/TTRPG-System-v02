import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import { KillEditor } from "@/features/xp/components/KillEditor";
import { PartyEditor } from "@/features/xp/components/PartyEditor";
import { XpNumberEditor } from "@/features/xp/XpNumberEditor";
import type { GameClient } from "@/hooks/useGameClient";
import {
  buildDeleteKillRequest,
  buildDeleteXpAdjustmentRequest,
  buildGetXpTrackerRequest,
  buildRecordKillRequest,
  buildSavePartyRequest,
  buildSaveXpAdjustmentRequest,
  buildSetMobXpValueRequest,
  buildSetSheetXpRequiredRequest
} from "@/infrastructure/ws/requestBuilders";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Field } from "@/shared/ui/Field";
import { Panel } from "@/shared/ui/Panel";

type XpView = "parties" | "registry" | "progress";

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function formatXp(value: number): string {
  return value.toFixed(2).replace(/\.00$/, "");
}

export function XpTrackerPage({ client }: { client: GameClient }): JSX.Element {
  const { state } = useAppStore();
  const { sheets, sheetOrder } = state.serverState;
  const { xpTracker } = state.uiState;
  const requestedTrackerRef = useRef(false);
  const [view, setView] = useState<XpView>("parties");
  const [newPartyName, setNewPartyName] = useState("");
  const [creditedInstanceId, setCreditedInstanceId] = useState("");
  const [monsterChoice, setMonsterChoice] = useState("");
  const [customMonsterName, setCustomMonsterName] = useState("");
  const [customXp, setCustomXp] = useState("0");
  const [killNotes, setKillNotes] = useState("");
  const [registryFilter, setRegistryFilter] = useState("");
  const [editingKillId, setEditingKillId] = useState<string | null>(null);
  const [adjustmentInstanceId, setAdjustmentInstanceId] = useState("");
  const [adjustmentAmount, setAdjustmentAmount] = useState("0");
  const [adjustmentReason, setAdjustmentReason] = useState("");

  useEffect(() => {
    if (requestedTrackerRef.current) return;
    requestedTrackerRef.current = true;
    client.sendProtocolRequest(buildGetXpTrackerRequest(), "Load XP tracker");
  }, [client]);

  const characters = xpTracker?.sheets ?? [];
  const playerSheets = useMemo(
    () => sheetOrder.map((id) => sheets[id]).filter((sheet) => sheet && !sheet.dm_only),
    [sheetOrder, sheets]
  );
  const unavailablePartyMembers = new Set(
    xpTracker?.parties.flatMap((party) => party.members.map((member) => member.instance_id)) ?? []
  );
  const selectedParty = xpTracker?.parties.find((party) =>
    party.members.some((member) => member.instance_id === creditedInstanceId)
  );
  const resolvedParticipants =
    selectedParty?.members ??
    characters.filter((character) => character.instance_id === creditedInstanceId);
  const filteredKills = (xpTracker?.kills ?? []).filter((kill) => {
    const query = registryFilter.trim().toLocaleLowerCase();
    return (
      !query ||
      kill.monster_name.toLocaleLowerCase().includes(query) ||
      kill.participants.some((participant) => participant.name.toLocaleLowerCase().includes(query))
    );
  });

  return (
    <Panel
      title="XP Registry"
      subtitle="Temporary proximity groups, permanent kill attribution, and derived character XP."
      actions={
        <button
          className="button button--secondary"
          type="button"
          onClick={() =>
            client.sendProtocolRequest(buildGetXpTrackerRequest(), "Refresh XP tracker")
          }
        >
          Refresh
        </button>
      }
    >
      <div className="xp-view-tabs" role="tablist" aria-label="XP registry views">
        {(["parties", "registry", "progress"] as const).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={view === item}
            className={view === item ? "is-active" : ""}
            onClick={() => setView(item)}
          >
            {item === "parties" ? "Parties" : item === "registry" ? "Kill Registry" : "XP Progress"}
          </button>
        ))}
      </div>

      {!xpTracker ? <EmptyState message="XP registry has not loaded." /> : null}

      {xpTracker && view === "parties" ? (
        <div className="xp-workspace">
          <form
            className="xp-create-row"
            onSubmit={(event) => {
              event.preventDefault();
              if (!newPartyName.trim()) return;
              client.sendProtocolRequest(
                buildSavePartyRequest({
                  partyId: newId("party"),
                  name: newPartyName.trim(),
                  memberInstanceIds: []
                }),
                `Create party: ${newPartyName}`
              );
              setNewPartyName("");
            }}
          >
            <Field label="New party">
              <input
                value={newPartyName}
                onChange={(event) => setNewPartyName(event.target.value)}
              />
            </Field>
            <button
              className="button button--primary"
              type="submit"
              disabled={!newPartyName.trim()}
            >
              Create Party
            </button>
          </form>
          {xpTracker.parties.length === 0 ? <EmptyState message="No active parties." /> : null}
          <div className="xp-party-list">
            {xpTracker.parties.map((party) => (
              <PartyEditor
                key={party.id}
                party={party}
                characters={characters}
                unavailableIds={unavailablePartyMembers}
                client={client}
              />
            ))}
          </div>
        </div>
      ) : null}

      {xpTracker && view === "registry" ? (
        <div className="xp-workspace xp-registry-layout">
          <form
            className="xp-kill-create"
            onSubmit={(event) => {
              event.preventDefault();
              const custom = monsterChoice === "custom";
              const xp = Number(customXp);
              if (
                !creditedInstanceId ||
                (!monsterChoice && !custom) ||
                (custom && (!customMonsterName.trim() || !Number.isFinite(xp)))
              )
                return;
              client.sendProtocolRequest(
                buildRecordKillRequest({
                  killId: newId("kill"),
                  creditedInstanceId,
                  monsterSheetId: custom ? null : monsterChoice,
                  monsterName: custom ? customMonsterName.trim() : null,
                  baseXp: custom ? xp : null,
                  notes: killNotes
                }),
                `Record kill: ${custom ? customMonsterName : "monster"}`
              );
              setKillNotes("");
            }}
          >
            <h3>Record Kill</h3>
            <Field label="Credited character">
              <select
                value={creditedInstanceId}
                onChange={(event) => setCreditedInstanceId(event.target.value)}
              >
                <option value="">Select character</option>
                {characters.map((character) => (
                  <option key={character.instance_id} value={character.instance_id}>
                    {character.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Monster">
              <select
                value={monsterChoice}
                onChange={(event) => setMonsterChoice(event.target.value)}
              >
                <option value="">Select monster</option>
                {xpTracker.mobs.map((mob) => (
                  <option key={mob.sheet_id} value={mob.sheet_id}>
                    {mob.name} · {formatXp(mob.xp_value)} XP
                  </option>
                ))}
                <option value="custom">Arbitrary kill</option>
              </select>
            </Field>
            {monsterChoice === "custom" ? (
              <div className="xp-custom-kill-fields">
                <Field label="Monster name">
                  <input
                    value={customMonsterName}
                    onChange={(event) => setCustomMonsterName(event.target.value)}
                  />
                </Field>
                <Field label="Base XP">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={customXp}
                    onChange={(event) => setCustomXp(event.target.value)}
                  />
                </Field>
              </div>
            ) : null}
            <Field label="Notes">
              <input value={killNotes} onChange={(event) => setKillNotes(event.target.value)} />
            </Field>
            <div className="xp-resolved-party">
              <span>Participants</span>
              <strong>{resolvedParticipants.length || 0}</strong>
              <small>
                {resolvedParticipants.map((participant) => participant.name).join(", ") ||
                  "Select a character"}
              </small>
            </div>
            <button className="button button--primary" type="submit">
              Record Kill
            </button>
          </form>

          <section className="xp-registry-list">
            <div className="xp-registry-list__header">
              <h3>Registry</h3>
              <input
                type="search"
                aria-label="Filter kill registry"
                placeholder="Filter monster or character"
                value={registryFilter}
                onChange={(event) => setRegistryFilter(event.target.value)}
              />
            </div>
            {filteredKills.length === 0 ? <EmptyState message="No matching kills." /> : null}
            {filteredKills.map((kill) => (
              <article className="xp-registry-entry" key={kill.id}>
                <div className="xp-registry-entry__summary">
                  <div>
                    <strong>{kill.monster_name}</strong>
                    <span>{new Date(kill.occurred_at).toLocaleString()}</span>
                  </div>
                  <div>
                    <strong>{formatXp(kill.xp_per_participant)} XP each</strong>
                    <span>
                      {formatXp(kill.xp_percentage)}% · {kill.participant_count} participants
                    </span>
                  </div>
                  <div className="inline-actions">
                    <button
                      className="button button--secondary"
                      type="button"
                      onClick={() => setEditingKillId(kill.id)}
                    >
                      Edit
                    </button>
                    <button
                      className="button button--danger"
                      type="button"
                      onClick={() =>
                        client.sendProtocolRequest(
                          buildDeleteKillRequest({ killId: kill.id }),
                          `Delete kill: ${kill.monster_name}`
                        )
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p>{kill.participants.map((participant) => participant.name).join(", ")}</p>
                {editingKillId === kill.id ? (
                  <KillEditor
                    kill={kill}
                    characters={characters}
                    client={client}
                    onClose={() => setEditingKillId(null)}
                  />
                ) : null}
              </article>
            ))}
          </section>
        </div>
      ) : null}

      {xpTracker && view === "progress" ? (
        <div className="xp-workspace xp-progress-layout">
          <section className="xp-tracker-section">
            <h3>Character Progress</h3>
            {characters.map((sheet) => (
              <article className="xp-progress-row" key={sheet.instance_id}>
                <div className="xp-progress-row__header">
                  <strong>{sheet.name}</strong>
                  <span
                    className={
                      sheet.ready_to_level ? "status-badge status-badge--ready" : "status-badge"
                    }
                  >
                    {sheet.xp_required === 0
                      ? "Threshold not set"
                      : `${formatXp(sheet.current_xp)} / ${formatXp(sheet.xp_required)} XP`}
                  </span>
                </div>
                {sheet.xp_required > 0 ? (
                  <progress
                    value={Math.min(sheet.current_xp, sheet.xp_required)}
                    max={sheet.xp_required}
                  />
                ) : null}
              </article>
            ))}
          </section>

          <section className="xp-tracker-section">
            <h3>Manual Adjustment</h3>
            <form
              className="xp-adjustment-form"
              onSubmit={(event) => {
                event.preventDefault();
                const amount = Number(adjustmentAmount);
                if (!adjustmentInstanceId || !Number.isFinite(amount)) return;
                client.sendProtocolRequest(
                  buildSaveXpAdjustmentRequest({
                    adjustmentId: newId("xp_adjustment"),
                    instanceId: adjustmentInstanceId,
                    amount,
                    reason: adjustmentReason
                  }),
                  "Add XP adjustment"
                );
                setAdjustmentAmount("0");
                setAdjustmentReason("");
              }}
            >
              <Field label="Character">
                <select
                  value={adjustmentInstanceId}
                  onChange={(event) => setAdjustmentInstanceId(event.target.value)}
                >
                  <option value="">Select character</option>
                  {characters.map((character) => (
                    <option key={character.instance_id} value={character.instance_id}>
                      {character.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="XP amount">
                <input
                  type="number"
                  step={0.01}
                  value={adjustmentAmount}
                  onChange={(event) => setAdjustmentAmount(event.target.value)}
                />
              </Field>
              <Field label="Reason">
                <input
                  value={adjustmentReason}
                  onChange={(event) => setAdjustmentReason(event.target.value)}
                />
              </Field>
              <button className="button button--primary" type="submit">
                Add Adjustment
              </button>
            </form>
            {xpTracker.adjustments.map((adjustment) => (
              <div className="xp-adjustment-row" key={adjustment.id}>
                <span>
                  {adjustment.instance_name} · {adjustment.reason || "Manual adjustment"}
                </span>
                <strong>{formatXp(adjustment.amount)} XP</strong>
                <button
                  className="button button--danger"
                  type="button"
                  onClick={() =>
                    client.sendProtocolRequest(
                      buildDeleteXpAdjustmentRequest({ adjustmentId: adjustment.id }),
                      "Delete XP adjustment"
                    )
                  }
                >
                  Delete
                </button>
              </div>
            ))}
          </section>

          <section className="xp-tracker-section">
            <h3>Player Thresholds</h3>
            <div className="xp-config-list">
              {playerSheets.map((sheet) => (
                <div className="xp-config-row" key={sheet.id}>
                  <strong>{sheet.name}</strong>
                  <XpNumberEditor
                    label="XP required"
                    value={sheet.xp_cap}
                    onSave={(xpRequired) =>
                      client.sendProtocolRequest(
                        buildSetSheetXpRequiredRequest({ sheetId: sheet.id, xpRequired }),
                        `Update XP threshold: ${sheet.name}`
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="xp-tracker-section">
            <h3>Monster XP Defaults</h3>
            <div className="xp-config-list">
              {xpTracker.mobs.map((mob) => (
                <div className="xp-config-row" key={mob.sheet_id}>
                  <strong>{mob.name}</strong>
                  <XpNumberEditor
                    label="XP per kill"
                    value={mob.xp_value}
                    onSave={(xpValue) =>
                      client.sendProtocolRequest(
                        buildSetMobXpValueRequest({ mobSheetId: mob.sheet_id, xpValue }),
                        `Update monster XP: ${mob.name}`
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </Panel>
  );
}
