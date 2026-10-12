import { SigilItemBinding } from "./SigilItemBinding";
import { canAuthorSigils, canOpenSigils } from "./sigilAccess";
import { SigilPlayerAccess } from "./SigilPlayerAccess";
import { useEffect, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import type { SigilPayload, SigilPreview } from "@/generated/backendProtocol";
import { SigilNodeEditor } from "./SigilNodeEditor";
import type { GameClient } from "@/hooks/useGameClient";
import {
  buildDeleteSigilRequest,
  buildDuplicateSigilRequest,
  buildSaveSigilRequest,
  buildSigilNodeRequest
} from "@/infrastructure/ws/requestBuilders";
import { Panel } from "@/shared/ui/Panel";
import { confirmDestructiveAction } from "@/shared/ui/confirmDestructiveAction";
import { makeId } from "@/shared/utils/id";
import { newNode, orderedTree } from "./sigilTree";
import "./sigils.css";

export function SigilManagementPage({ client }: { client: GameClient }): JSX.Element {
  const { state } = useAppStore();
  const { sigils, persistentSheets, sheets, role } = state.serverState;
  const [draft, setDraft] = useState<SigilPayload | null>(null);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [actorId, setActorId] = useState(state.uiState.activeSheetId ?? "");
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<SigilPreview | null>(null);
  const [visibility, setVisibility] = useState<"public" | "gm">("public");
  const saved = draft ? sigils[draft.id] : undefined;
  const node = draft?.nodes.find((entry) => entry.id === nodeId);
  const owns = role === "gm" || draft?.owner_instance_id === state.uiState.activeSheetId;
  const canCreate = canAuthorSigils(state);
  const manage = canCreate && owns;
  const pending = pendingId !== null && state.uiState.pendingIntentIds.includes(pendingId);
  const actorName = (id: string) => {
    const instance = persistentSheets[id];
    return instance ? (sheets[instance.parent_id]?.name ?? id) : id;
  };

  useEffect(
    () =>
      client.onEvent((event) => {
        if (event.type === "sigil_preview" && event.requestId === pendingId)
          setPreview(event.preview);
        if (event.type === "error" && event.requestId === pendingId) setError(event.message);
      }),
    [client, pendingId]
  );

  useEffect(() => {
    if (saved && !dirty) setDraft(structuredClone(saved));
  }, [saved, dirty]);

  useEffect(() => {
    if (!canCreate && dirty) {
      setDraft(saved ? structuredClone(saved) : null);
      setDirty(false);
      setPreview(null);
    }
  }, [canCreate, dirty, saved]);

  function submit(request: Parameters<GameClient["sendProtocolRequest"]>[0], label: string): void {
    setError("");
    setPendingId(request.request_id ?? null);
    client.sendProtocolRequest(request, label);
  }
  function save(): void {
    if (!draft) return;
    if (
      draft.nodes.some(
        (entry) => !entry.name.trim() || !Number.isFinite(entry.diameter) || entry.diameter <= 0
      )
    ) {
      setError("Each node needs a name and a positive diameter.");
      return;
    }
    submit(
      buildSaveSigilRequest(
        {
          sigil_id: draft.id,
          owner_instance_id: draft.owner_instance_id,
          expected_revision: saved ? draft.revision : null,
          item_relationship_id: draft.item_relationship_id,
          access_instance_ids: draft.access_instance_ids,
          nodes: draft.nodes.map(
            ({ id, name, diameter, parent_id, action_id, mana_cost_step_ids, power_step_ids }) => ({
              id,
              name,
              diameter,
              parent_id,
              action_id,
              mana_cost_step_ids,
              power_step_ids
            })
          )
        },
        makeId("request")
      ),
      "Save sigil"
    );
    // Retain the draft on rejection; reconcile only the successful correlated patch.
  }
  useEffect(
    () =>
      client.onEvent((event) => {
        if (event.type === "snapshot" && event.requestId === pendingId) {
          setDirty(false);
          if (draft && !(event.snapshot.sigils ?? []).some((entry) => entry.id === draft.id)) {
            setDraft(null);
          }
        }
      }),
    [client, pendingId, draft]
  );

  function runtime(
    type: "imbue_sigil" | "activate_sigil" | "discharge_sigil" | "preview_sigil"
  ): void {
    if (!draft || !node || !actorId) return;
    submit(
      buildSigilNodeRequest(
        type,
        {
          sigil_id: draft.id,
          node_id: node.id,
          instance_id: actorId,
          ...(type === "activate_sigil" ? { visibility } : {})
        },
        makeId("request")
      ),
      type === "preview_sigil"
        ? "Preview sigil"
        : type === "imbue_sigil"
          ? "Imbue sigil"
          : type === "activate_sigil"
            ? "Activate sigil"
            : "Discharge sigil"
    );
  }

  const canRuntime = saved && !dirty && !pending && node?.action_id && actorId;
  const charged = Boolean(node?.charge);

  if (!canOpenSigils(state)) return <></>;

  return (
    <Panel
      title="Sigil Management"
      variant="workspace"
      subtitle="Persistent inscriptions powered by existing Actions."
    >
      {role === "gm" && <SigilPlayerAccess client={client} />}
      <div className="sigil-layout">
        <aside className="sigil-list">
          {canCreate && (
            <button
              disabled={!actorId || pending}
              onClick={() => {
                const root = newNode(null);
                setDraft({
                  id: makeId("sigil"),
                  owner_instance_id: actorId,
                  nodes: [root],
                  access_instance_ids: [],
                  item_relationship_id: null,
                  revision: 0
                });
                setNodeId(root.id);
                setDirty(true);
                setError("");
              }}
            >
              Create sigil
            </button>
          )}
          {Object.values(sigils).map((entry) => (
            <button
              key={entry.id}
              aria-pressed={draft?.id === entry.id}
              onClick={() => {
                setDraft(structuredClone(entry));
                setNodeId(entry.nodes.find((value) => !value.parent_id)?.id ?? null);
                setDirty(false);
                setPreview(null);
                setError("");
              }}
            >
              {entry.nodes.find((value) => !value.parent_id)?.name} ·{" "}
              {entry.nodes.filter((value) => value.charge).length} charged
            </button>
          ))}
          {!Object.keys(sigils).length && <p>No sigils yet.</p>}
          <label>
            Acting character
            <select
              value={actorId}
              disabled={pending}
              onChange={(event) => {
                setActorId(event.target.value);
                setPreview(null);
              }}
            >
              <option value="">Select character</option>
              {Object.keys(persistentSheets).map((id) => (
                <option key={id} value={id}>
                  {actorName(id)}
                </option>
              ))}
            </select>
          </label>
        </aside>
        {draft && node ? (
          <div className="sigil-editor">
            {error && <p role="alert">{error}</p>}
            {pending && <p role="status">Waiting for the server…</p>}
            {saved && draft.revision !== saved.revision && dirty && (
              <p role="alert">This sigil changed on the server. Reload before saving.</p>
            )}
            {manage && (
              <div className="sigil-controls">
                <button disabled={!manage || pending} onClick={save}>
                  Save configuration
                </button>
                <button
                  disabled={!saved || pending}
                  onClick={() => {
                    if (saved) {
                      setDraft(structuredClone(saved));
                      setDirty(false);
                      setPreview(null);
                    }
                  }}
                >
                  Reload
                </button>
                <button
                  disabled={!saved || !manage || pending}
                  onClick={() =>
                    submit(
                      buildDuplicateSigilRequest(draft.id, makeId("request")),
                      "Duplicate sigil"
                    )
                  }
                >
                  Duplicate sigil
                </button>
                <button
                  disabled={!saved || !manage || pending}
                  onClick={() => {
                    if (
                      saved &&
                      confirmDestructiveAction({
                        action: "Delete",
                        subject: draft.nodes[0].name,
                        consequence: "All nodes and stored charges will be removed."
                      })
                    ) {
                      submit(
                        buildDeleteSigilRequest(draft.id, draft.revision ?? 0, makeId("request")),
                        "Delete sigil"
                      );
                    }
                  }}
                >
                  Delete sigil
                </button>
              </div>
            )}
            {manage && (
              <SigilItemBinding
                sigil={draft}
                disabled={pending}
                onChange={(itemRelationshipId) => {
                  setDraft({ ...draft, item_relationship_id: itemRelationshipId });
                  setDirty(true);
                  setPreview(null);
                }}
              />
            )}
            <div className="sigil-tree" aria-label="Sigil hierarchy">
              {orderedTree(draft.nodes).map(({ node: entry, depth }) => (
                <button
                  key={entry.id}
                  style={{ marginLeft: `${Math.min(depth, 12) * 1.25}rem` }}
                  aria-pressed={entry.id === nodeId}
                  onClick={() => {
                    setNodeId(entry.id);
                    setPreview(null);
                  }}
                >
                  {entry.name} · {entry.charge ? "Charged" : "Uncharged"}
                  {depth > 12 ? ` · depth ${depth}` : ""}
                </button>
              ))}
            </div>
            {manage ? (
              <SigilNodeEditor
                draft={draft}
                node={node}
                editable={Boolean(manage && !pending)}
                onChangeDraft={(value) => {
                  setDraft(value);
                  setDirty(true);
                  setPreview(null);
                }}
                onSelectNode={setNodeId}
                actorName={actorName}
              />
            ) : (
              <p>
                {node.name} · Diameter: {node.diameter} m · Action:{" "}
                {node.action_id
                  ? (state.serverState.actions[node.action_id]?.name ?? node.action_id)
                  : "None"}
              </p>
            )}
            <p>
              Status: {charged ? "Charged" : "Uncharged"} · Last imbuer:{" "}
              {node.last_imbuer_instance_id ? actorName(node.last_imbuer_instance_id) : "None"}
            </p>
            <p>
              {preview && preview.sigil_id === draft.id && preview.node_id === node.id
                ? `Power multiplier: ${preview.multiplier} · Mana cost: ${preview.mana_cost}`
                : "Request a server preview to see the multiplier and mana cost."}
            </p>
            <div className="sigil-controls">
              <button disabled={!canRuntime} onClick={() => runtime("preview_sigil")}>
                Preview cost
              </button>
              <button disabled={!canRuntime || charged} onClick={() => runtime("imbue_sigil")}>
                {node.last_imbuer_instance_id ? "Recharge" : "Imbue"}
              </button>
              <label>
                Roll20 audience
                <select
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value as "public" | "gm")}
                >
                  <option value="public">Public</option>
                  <option value="gm">GM only</option>
                </select>
              </label>
              <button disabled={!canRuntime || !charged} onClick={() => runtime("activate_sigil")}>
                Activate
              </button>
              <button
                disabled={!canRuntime || !charged || !owns}
                onClick={() => {
                  if (
                    confirmDestructiveAction({
                      action: "Remove",
                      subject: `${node.name} charge`,
                      consequence: "The stored charge will be discarded without a mana refund."
                    })
                  )
                    runtime("discharge_sigil");
                }}
              >
                Discard charge
              </button>
            </div>
            {dirty && <p>Save configuration before imbuing or activating.</p>}
          </div>
        ) : (
          <p>Select a sigil to view its charge and activation controls.</p>
        )}
      </div>
    </Panel>
  );
}
