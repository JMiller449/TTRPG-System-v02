import { KillHistoryFilters } from "@/features/xp/KillHistoryFilters";
import { useKillFilters } from "@/features/xp/useKillFilters";
import { KillQuantityField } from "@/features/xp/KillQuantityField";
import { XpProgressionEditor } from "./XpProgressionEditor";
import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import { KillEditor } from "@/features/xp/components/KillEditor";
import { PartyFolderWorkspace } from "@/features/xp/components/PartyFolderWorkspace";
import { XpNumberEditor } from "@/features/xp/XpNumberEditor";
import type { GameClient } from "@/hooks/useGameClient";
import {
  buildDeleteKillRequest,
  buildDeleteXpAdjustmentRequest,
  buildGetXpTrackerRequest,
  buildRecordKillRequest,
  buildSavePartyRequest,
  buildSaveXpAdjustmentRequest,
  buildSetMobKillVisibilityRequest,
  buildSetMobXpValueRequest
} from "@/infrastructure/ws/requestBuilders";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Field } from "@/shared/ui/Field";
import { Panel } from "@/shared/ui/Panel";
import { confirmDestructiveAction } from "@/shared/ui/confirmDestructiveAction";
import { CatalogEntityPicker } from "@/features/catalogs/CatalogEntityPicker";

type XpView = "parties" | "registry" | "progress";

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function formatXp(value: number): string {
  return value.toFixed(2).replace(/\.00$/, "");
}

export function XpTrackerPage({ client }: { client: GameClient }): JSX.Element {
  const { state } = useAppStore();
  const { xpTracker } = state.uiState;
  const requestedTrackerRef = useRef(false);
  const submittingKillRef = useRef<string | null>(null);
  const [pendingKillRequestId, setPendingKillRequestId] = useState<string | null>(null);
  const [view, setView] = useState<XpView>("parties");
  const [newPartyName, setNewPartyName] = useState("");
  const [creditedInstanceId, setCreditedInstanceId] = useState("");
  const [monsterChoice, setMonsterChoice] = useState("");
  const [customMonsterName, setCustomMonsterName] = useState("");
  const [customXp, setCustomXp] = useState("0");
  const [quantity, setQuantity] = useState("1");
  const validQuantity =
    Number.isInteger(Number(quantity)) && Number(quantity) >= 1 && Number(quantity) <= 10000;
  const [killNotes, setKillNotes] = useState("");
  const [editingKillId, setEditingKillId] = useState<string | null>(null);
  const [adjustmentInstanceId, setAdjustmentInstanceId] = useState("");
  const [adjustmentAmount, setAdjustmentAmount] = useState("0");
  const [adjustmentReason, setAdjustmentReason] = useState("");

  useEffect(() => {
    if (requestedTrackerRef.current) return;
    requestedTrackerRef.current = true;
    client.sendProtocolRequest(buildGetXpTrackerRequest(), "Load XP tracker");
  }, [client]);

  useEffect(
    () =>
      client.onEvent((event) => {
        const requestId = submittingKillRef.current;
        if (!requestId || !("requestId" in event) || event.requestId !== requestId) return;
        if (event.type === "error" || event.type === "snapshot" || event.type === "xp_tracker") {
          submittingKillRef.current = null;
          setPendingKillRequestId(null);
          if (event.type !== "error") {
            setKillNotes("");
            setQuantity("1");
          }
        }
      }),
    [client]
  );

  const characters = xpTracker?.sheets ?? [];
  const selectedParty = xpTracker?.parties.find((party) =>
    party.members.some((member) => member.instance_id === creditedInstanceId)
  );
  const resolvedParticipants =
    selectedParty?.members ??
    characters.filter((character) => character.instance_id === creditedInstanceId);
  const { filters, setFilters, filteredKills } = useKillFilters(xpTracker?.kills ?? [], "registry");

  return (
    <Panel
      variant="workspace"
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
          <PartyFolderWorkspace
            parties={xpTracker.parties}
            characters={characters}
            client={client}
          />
        </div>
      ) : null}

      {xpTracker && view === "registry" ? (
        <div className="xp-workspace xp-registry-layout">
          <form
            className="xp-kill-create xp-workspace-card"
            onSubmit={(event) => {
              event.preventDefault();
              const custom = monsterChoice === "custom";
              const xp = Number(customXp);
              if (
                submittingKillRef.current ||
                !validQuantity ||
                !creditedInstanceId ||
                (!monsterChoice && !custom) ||
                (custom && (!customMonsterName.trim() || !Number.isFinite(xp)))
              )
                return;
              const requestId = newId("request");
              submittingKillRef.current = requestId;
              setPendingKillRequestId(requestId);
              client.sendProtocolRequest(
                buildRecordKillRequest({
                  requestId,
                  killId: newId("kill"),
                  creditedInstanceId,
                  monsterSheetId: custom ? null : monsterChoice,
                  monsterName: custom ? customMonsterName.trim() : null,
                  baseXp: custom ? xp : null,
                  quantity: Number(quantity),
                  notes: killNotes
                }),
                `Record kill: ${custom ? customMonsterName : "monster"}`
              );
            }}
          >
            <h3>Record Kill</h3>
            <CatalogEntityPicker
              catalog="sheet_instances"
              label="Credited character"
              placeholder="Search spawned sheets"
              selectedId={creditedInstanceId}
              disabled={pendingKillRequestId !== null}
              options={characters.map((character) => ({
                id: character.instance_id,
                label: character.name,
                value: character.instance_id
              }))}
              emptyMessage="No characters available."
              onSelect={setCreditedInstanceId}
            />
            <CatalogEntityPicker
              catalog="sheet_templates"
              label="Monster"
              placeholder="Search enemy templates"
              selectedId={monsterChoice}
              disabled={pendingKillRequestId !== null}
              options={[
                ...xpTracker.mobs.map((mob) => ({
                  id: mob.sheet_id,
                  label: mob.name,
                  secondary: `${formatXp(mob.xp_value)} XP`,
                  value: mob.sheet_id
                })),
                {
                  id: "custom",
                  label: "Arbitrary kill",
                  keywords: ["custom"],
                  value: "custom"
                }
              ]}
              emptyMessage="No monsters available."
              onSelect={setMonsterChoice}
            />
            {monsterChoice === "custom" ? (
              <div className="xp-custom-kill-fields">
                <Field label="Monster name">
                  <input
                    value={customMonsterName}
                    disabled={pendingKillRequestId !== null}
                    onChange={(event) => setCustomMonsterName(event.target.value)}
                  />
                </Field>
                <Field label="XP per kill">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={customXp}
                    disabled={pendingKillRequestId !== null}
                    onChange={(event) => setCustomXp(event.target.value)}
                  />
                </Field>
              </div>
            ) : null}
            <KillQuantityField
              value={quantity}
              onChange={setQuantity}
              disabled={pendingKillRequestId !== null}
            />
            <Field label="Notes">
              <input
                value={killNotes}
                disabled={pendingKillRequestId !== null}
                onChange={(event) => setKillNotes(event.target.value)}
              />
            </Field>
            <div className="xp-resolved-party">
              <span>Participants</span>
              <strong>{resolvedParticipants.length || 0}</strong>
              <small>
                {resolvedParticipants.map((participant) => participant.name).join(", ") ||
                  "Select a character"}
              </small>
            </div>
            <button
              className="button button--primary"
              type="submit"
              disabled={pendingKillRequestId !== null}
            >
              {pendingKillRequestId
                ? "Recording…"
                : validQuantity && Number(quantity) > 1
                  ? `Record ${Number(quantity)} Kills`
                  : "Record Kill"}
            </button>
          </form>

          <section className="xp-registry-list">
            <div className="xp-registry-list__header">
              <h3>Registry</h3>
            </div>
            <KillHistoryFilters
              kills={xpTracker.kills}
              filters={filters}
              onChange={setFilters}
              matchingCount={filteredKills.length}
            />
            {filteredKills.length === 0 ? (
              <EmptyState
                message={
                  xpTracker.kills.length === 0
                    ? "No recorded kills."
                    : "No matching kills. Try changing or clearing the filters."
                }
              />
            ) : null}
            {filteredKills.map((kill) => (
              <article className="xp-registry-entry xp-workspace-card" key={kill.id}>
                <div className="xp-registry-entry__summary">
                  <div>
                    <strong>
                      {(kill.quantity ?? 1) > 1 ? `${kill.quantity}× ` : ""}
                      {kill.monster_name}
                    </strong>
                    <span>{new Date(kill.occurred_at).toLocaleString()}</span>
                  </div>
                  <div>
                    <strong>{formatXp(kill.xp_per_participant)} XP per participant</strong>
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
                      onClick={() => {
                        if (
                          !confirmDestructiveAction({
                            action: "Delete",
                            subject: `${kill.monster_name} kill record`,
                            consequence:
                              "This permanently removes the kill and its XP awards from every participant."
                          })
                        ) {
                          return;
                        }
                        client.sendProtocolRequest(
                          buildDeleteKillRequest({ killId: kill.id }),
                          `Delete kill: ${kill.monster_name}`
                        );
                      }}
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
          <section className="xp-tracker-section xp-workspace-card">
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
                    {sheet.goal_error ??
                      (sheet.xp_required === 0
                        ? "Goal unavailable"
                        : `${formatXp(sheet.current_xp)} / ${formatXp(sheet.xp_required)} XP`)}
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

          <section className="xp-tracker-section xp-workspace-card">
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
              <CatalogEntityPicker
                catalog="sheet_instances"
                label="Character"
                placeholder="Search spawned sheets"
                selectedId={adjustmentInstanceId}
                options={characters.map((character) => ({
                  id: character.instance_id,
                  label: character.name,
                  value: character.instance_id
                }))}
                emptyMessage="No characters available."
                onSelect={setAdjustmentInstanceId}
              />
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
                  onClick={() => {
                    if (
                      !confirmDestructiveAction({
                        action: "Delete",
                        subject: `${adjustment.instance_name} XP adjustment`,
                        consequence:
                          "This permanently removes the adjustment and recalculates the character's XP."
                      })
                    ) {
                      return;
                    }
                    client.sendProtocolRequest(
                      buildDeleteXpAdjustmentRequest({ adjustmentId: adjustment.id }),
                      "Delete XP adjustment"
                    );
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </section>

          <XpProgressionEditor client={client} progression={xpTracker.progression} />

          <section className="xp-tracker-section xp-workspace-card">
            <h3>Monster XP Defaults</h3>
            <div className="xp-config-list">
              {xpTracker.mobs.map((mob) => (
                <div className="xp-config-row" key={mob.sheet_id}>
                  <div className="xp-mob-config-name">
                    <strong>{mob.name}</strong>
                    <label>
                      <input
                        type="checkbox"
                        checked={mob.visible_to_players}
                        onChange={(event) =>
                          client.sendProtocolRequest(
                            buildSetMobKillVisibilityRequest({
                              mobSheetId: mob.sheet_id,
                              visible: event.target.checked
                            }),
                            `${event.target.checked ? "Show" : "Hide"} player kill option: ${mob.name}`
                          )
                        }
                      />
                      Players can record
                    </label>
                  </div>
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
