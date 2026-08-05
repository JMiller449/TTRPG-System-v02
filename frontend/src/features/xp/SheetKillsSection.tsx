import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import type { GameClient } from "@/hooks/useGameClient";
import {
  buildGetXpTrackerRequest,
  buildRecordKillRequest,
  buildRecordPlayerKillRequest
} from "@/infrastructure/ws/requestBuilders";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Field } from "@/shared/ui/Field";
import { ModalDialog } from "@/shared/ui/ModalDialog";
import { makeId } from "@/shared/utils/id";
import { CatalogEntityPicker } from "@/features/catalogs/CatalogEntityPicker";

function formatXp(value: number): string {
  return value.toFixed(2).replace(/\.00$/, "");
}

export function SheetKillsSection({
  client,
  instanceId
}: {
  client: GameClient;
  instanceId: string;
  sheetId: string;
}): JSX.Element {
  const {
    state: {
      uiState: { xpTracker }
    }
  } = useAppStore();
  const requestedInstanceRef = useRef<string | null>(null);
  const submittingRequestRef = useRef<string | null>(null);
  const [selectedMobId, setSelectedMobId] = useState("");
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [gmKillDialogOpen, setGmKillDialogOpen] = useState(false);
  const [gmMonsterChoice, setGmMonsterChoice] = useState("");
  const [gmCustomMonsterName, setGmCustomMonsterName] = useState("");
  const [gmCustomXp, setGmCustomXp] = useState("0");
  const [gmKillNotes, setGmKillNotes] = useState("");

  useEffect(() => {
    if (requestedInstanceRef.current === instanceId) return;
    requestedInstanceRef.current = instanceId;
    client.sendProtocolRequest(buildGetXpTrackerRequest(), "Load kill registry");
  }, [client, instanceId]);

  useEffect(
    () =>
      client.onEvent((event) => {
        const requestId = submittingRequestRef.current;
        if (!requestId || !("requestId" in event) || event.requestId !== requestId) return;
        if (event.type === "error") {
          submittingRequestRef.current = null;
          setPendingRequestId(null);
          return;
        }
        if (event.type === "snapshot" || event.type === "xp_tracker") {
          submittingRequestRef.current = null;
          setPendingRequestId(null);
          setSelectedMobId("");
          setGmKillDialogOpen(false);
          setGmMonsterChoice("");
          setGmCustomMonsterName("");
          setGmCustomXp("0");
          setGmKillNotes("");
        }
      }),
    [client]
  );

  const trackerSheet = xpTracker?.sheets.find((entry) => entry.instance_id === instanceId);
  const selectedParty = xpTracker?.parties.find((party) =>
    party.members.some((member) => member.instance_id === instanceId)
  );
  const resolvedParticipants =
    selectedParty?.members ??
    (trackerSheet ? [{ instance_id: trackerSheet.instance_id, name: trackerSheet.name }] : []);
  const gmUsesCustomMonster = gmMonsterChoice === "custom";
  const parsedCustomXp = Number(gmCustomXp);
  const canSubmitGmKill =
    Boolean(gmMonsterChoice) &&
    (!gmUsesCustomMonster ||
      (Boolean(gmCustomMonsterName.trim()) &&
        Number.isFinite(parsedCustomXp) &&
        parsedCustomXp >= 0));

  const closeGmKillDialog = (): void => {
    if (pendingRequestId) return;
    setGmKillDialogOpen(false);
    setGmMonsterChoice("");
    setGmCustomMonsterName("");
    setGmCustomXp("0");
    setGmKillNotes("");
  };

  return (
    <section className="sheet-kills-section">
      {xpTracker?.can_manage ? (
        <div className="sheet-kills-section__toolbar">
          <button
            className="button"
            type="button"
            disabled={!trackerSheet}
            onClick={() => setGmKillDialogOpen(true)}
          >
            Add Kill
          </button>
        </div>
      ) : null}
      {xpTracker && !xpTracker.can_manage ? (
        <form
          className="xp-player-kill-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!selectedMobId || submittingRequestRef.current) return;
            const requestId = makeId("request");
            submittingRequestRef.current = requestId;
            setPendingRequestId(requestId);
            client.sendProtocolRequest(
              buildRecordPlayerKillRequest({
                killId: makeId("kill"),
                monsterSheetId: selectedMobId,
                requestId
              }),
              "Record kill"
            );
          }}
        >
          <CatalogEntityPicker
            catalog="sheet_templates"
            label="Defeated enemy"
            placeholder="Search enemy templates"
            selectedId={selectedMobId}
            disabled={pendingRequestId !== null}
            options={xpTracker.recordable_mobs.map((mob) => ({
              id: mob.sheet_id,
              label: mob.name,
              value: mob.sheet_id
            }))}
            emptyMessage="No enemies are currently available."
            onSelect={setSelectedMobId}
          />
          <button
            className="button button--primary"
            type="submit"
            disabled={!selectedMobId || pendingRequestId !== null}
          >
            {pendingRequestId ? "Recording…" : "Record Kill"}
          </button>
          {xpTracker.recordable_mobs.length === 0 ? (
            <small>No enemies are currently available to record.</small>
          ) : null}
        </form>
      ) : null}
      {!trackerSheet ? <EmptyState message="Kill history has not loaded." /> : null}
      {trackerSheet?.kills.length === 0 ? <EmptyState message="No recorded kills." /> : null}
      {trackerSheet && trackerSheet.kills.length > 0 ? (
        <section className="sheet-kill-history" aria-labelledby="sheet-kill-history-title">
          <div className="sheet-kill-history__header">
            <h4 id="sheet-kill-history-title">Kill history</h4>
            <span>
              {trackerSheet.kills.length} record{trackerSheet.kills.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="sheet-kill-grid">
            {trackerSheet.kills.map((kill) => (
              <article className="sheet-kill-card" key={kill.id}>
                <div className="sheet-kill-card__header">
                  <strong>{kill.monster_name}</strong>
                  <strong>{formatXp(kill.xp_per_participant)} XP</strong>
                </div>
                <time dateTime={kill.occurred_at}>
                  {new Date(kill.occurred_at).toLocaleString()}
                </time>
                {kill.submitted_by_name ? (
                  <span className="sheet-kill-card__recorder">
                    Recorded by {kill.submitted_by_name}
                  </span>
                ) : null}
                <footer>
                  <span>{formatXp(kill.xp_percentage)}% credit</span>
                  <span>
                    {kill.participant_count} participant
                    {kill.participant_count === 1 ? "" : "s"}
                  </span>
                </footer>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {trackerSheet && trackerSheet.adjustments.length > 0 ? (
        <div className="xp-adjustment-list">
          <h4>XP Adjustments</h4>
          {trackerSheet.adjustments.map((adjustment) => (
            <div className="xp-adjustment-row" key={adjustment.id}>
              <span>{adjustment.reason || "Manual adjustment"}</span>
              <strong>{formatXp(adjustment.amount)} XP</strong>
            </div>
          ))}
        </div>
      ) : null}
      {xpTracker?.can_manage && gmKillDialogOpen ? (
        <ModalDialog
          title="Add Kill"
          description={`Record a kill credited to “${trackerSheet?.name ?? "this character"}”. Current party membership determines the participants.`}
          pending={pendingRequestId !== null}
          onClose={closeGmKillDialog}
        >
          <form
            className="stack sheet-kill-create-dialog"
            onSubmit={(event) => {
              event.preventDefault();
              if (!canSubmitGmKill || submittingRequestRef.current) return;
              const requestId = makeId("request");
              submittingRequestRef.current = requestId;
              setPendingRequestId(requestId);
              client.sendProtocolRequest(
                buildRecordKillRequest({
                  killId: makeId("kill"),
                  creditedInstanceId: instanceId,
                  monsterSheetId: gmUsesCustomMonster ? null : gmMonsterChoice,
                  monsterName: gmUsesCustomMonster ? gmCustomMonsterName.trim() : null,
                  baseXp: gmUsesCustomMonster ? parsedCustomXp : null,
                  notes: gmKillNotes,
                  requestId
                }),
                `Record kill: ${
                  gmUsesCustomMonster
                    ? gmCustomMonsterName.trim()
                    : (xpTracker.mobs.find((mob) => mob.sheet_id === gmMonsterChoice)?.name ??
                      "monster")
                }`
              );
            }}
          >
            <CatalogEntityPicker
              catalog="sheet_templates"
              label="Defeated enemy"
              placeholder="Search enemy templates"
              selectedId={gmMonsterChoice}
              disabled={pendingRequestId !== null}
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
              emptyMessage="No enemy templates available."
              onSelect={setGmMonsterChoice}
            />
            {gmUsesCustomMonster ? (
              <div className="xp-custom-kill-fields">
                <Field label="Enemy name">
                  <input
                    value={gmCustomMonsterName}
                    disabled={pendingRequestId !== null}
                    onChange={(event) => setGmCustomMonsterName(event.target.value)}
                  />
                </Field>
                <Field label="Base XP">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={gmCustomXp}
                    disabled={pendingRequestId !== null}
                    onChange={(event) => setGmCustomXp(event.target.value)}
                  />
                </Field>
              </div>
            ) : null}
            <Field label="Notes">
              <input
                value={gmKillNotes}
                disabled={pendingRequestId !== null}
                onChange={(event) => setGmKillNotes(event.target.value)}
              />
            </Field>
            <div className="xp-resolved-party">
              <span>Participants</span>
              <strong>{resolvedParticipants.length}</strong>
              <small>
                {resolvedParticipants.map((participant) => participant.name).join(", ") ||
                  "No participants available"}
              </small>
            </div>
            <div className="inline-actions sheet-kill-create-dialog__actions">
              <button
                className="button"
                type="submit"
                disabled={!canSubmitGmKill || pendingRequestId !== null}
              >
                {pendingRequestId ? "Recording…" : "Record Kill"}
              </button>
              <button
                className="button button--secondary"
                type="button"
                disabled={pendingRequestId !== null}
                onClick={closeGmKillDialog}
              >
                Cancel
              </button>
            </div>
          </form>
        </ModalDialog>
      ) : null}
    </section>
  );
}
