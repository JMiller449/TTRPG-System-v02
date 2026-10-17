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
import { CatalogEditorLayout } from "@/shared/ui/CatalogEditorLayout";
import { Field } from "@/shared/ui/Field";
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
      subtitle="Browse saved sigils and configure inscriptions powered by existing Actions."
      actions={
        canCreate && (
          <button
            className="button button--primary"
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
        )
      }
    >
      {role === "gm" && (
        <details className="authoring-disclosure sigil-access-disclosure">
          <summary>
            <span>
              <strong>Player creation access</strong>
              <small>Choose who can create and edit sigils</small>
            </span>
          </summary>
          <div className="authoring-disclosure__body">
            <SigilPlayerAccess client={client} />
          </div>
        </details>
      )}
      <CatalogEditorLayout
        catalogLabel="Sigils"
        editorClassName="authoring-workspace__editor--vertical"
        catalog={
          <div className="sigil-list">
            {Object.values(sigils).map((entry) => (
              <button
                className="button button--secondary"
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
            <Field label="Acting character">
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
            </Field>
          </div>
        }
      >
        {draft && node ? (
          <div className="sigil-editor stack">
            <div className="sigil-editor__heading">
              <h3>{manage ? (saved ? "Edit Sigil" : "Create Sigil") : "View Sigil"}</h3>
              <span className="muted">
                {draft.nodes.length} nodes · {draft.nodes.filter((entry) => entry.charge).length}{" "}
                charged
              </span>
            </div>
            {error && <p role="alert">{error}</p>}
            {pending && <p role="status">Waiting for the server…</p>}
            {saved && draft.revision !== saved.revision && dirty && (
              <p role="alert">This sigil changed on the server. Reload before saving.</p>
            )}
            <section className="sigil-details-section stack">
              <h3>Details</h3>
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
            </section>
            <details className="authoring-disclosure" open>
              <summary>
                <span>
                  <strong>Sigil hierarchy</strong>
                  <small>Select a node to configure its inscription</small>
                </span>
              </summary>
              <div className="authoring-disclosure__body">
                <div className="sigil-tree" aria-label="Sigil hierarchy">
                  {orderedTree(draft.nodes).map(({ node: entry, depth }) => (
                    <button
                      className="button button--secondary"
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
              </div>
            </details>
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
            <details className="authoring-disclosure" open>
              <summary>
                <span>
                  <strong>Charge and activation</strong>
                  <small>Preview cost, imbue, and use the selected node</small>
                </span>
              </summary>
              <div className="authoring-disclosure__body stack">
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
                  <button
                    className="button button--secondary"
                    disabled={!canRuntime}
                    onClick={() => runtime("preview_sigil")}
                  >
                    Preview cost
                  </button>
                  <button
                    className="button button--secondary"
                    disabled={!canRuntime || charged}
                    onClick={() => runtime("imbue_sigil")}
                  >
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
                  <button
                    className="button button--secondary"
                    disabled={!canRuntime || !charged}
                    onClick={() => runtime("activate_sigil")}
                  >
                    Activate
                  </button>
                  <button
                    className="button button--secondary"
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
                {dirty && <p className="muted">Save configuration before imbuing or activating.</p>}
              </div>
            </details>
            {manage && (
              <div className="template-editor__actions sigil-editor__actions">
                <button className="button" disabled={!manage || pending} onClick={save}>
                  Save configuration
                </button>
                <button
                  className="button button--secondary"
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
                  className="button button--secondary"
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
                  className="button button--danger"
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
          </div>
        ) : (
          <div className="sigil-empty-state">
            <h3>Select a sigil</h3>
            <p className="muted">Select a sigil to view its charge and activation controls.</p>
          </div>
        )}
      </CatalogEditorLayout>
    </Panel>
  );
}
