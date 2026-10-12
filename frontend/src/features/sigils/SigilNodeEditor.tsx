import { useAppStore } from "@/app/state/useAppStore";
import type { SigilNodePayload, SigilPayload } from "@/generated/backendProtocol";
import { CatalogEntityPicker } from "@/features/catalogs/CatalogEntityPicker";
import { confirmDestructiveAction } from "@/shared/ui/confirmDestructiveAction";
import { descendants, duplicateBranch, newNode, reorderNode } from "./sigilTree";

export function SigilNodeEditor({
  draft,
  node,
  editable,
  onChangeDraft,
  onSelectNode,
  actorName
}: {
  draft: SigilPayload;
  node: SigilNodePayload;
  editable: boolean;
  onChangeDraft: (draft: SigilPayload) => void;
  onSelectNode: (id: string | null) => void;
  actorName: (id: string) => string;
}): JSX.Element {
  const { state } = useAppStore();
  const { role, actions, persistentSheets } = state.serverState;
  const action = node.action_id ? actions[node.action_id] : undefined;
  const charged = Boolean(node.charge);
  const blocked = descendants(draft.nodes, node.id);
  const update = (nodes: SigilNodePayload[]) => onChangeDraft({ ...draft, nodes });
  const editNode = (values: Partial<SigilNodePayload>) =>
    update(draft.nodes.map((entry) => (entry.id === node.id ? { ...entry, ...values } : entry)));
  return (
    <fieldset disabled={!editable}>
      <legend>{node.name}</legend>
      <label>
        Name (required)
        <input value={node.name} onChange={(event) => editNode({ name: event.target.value })} />
      </label>
      <label>
        Diameter in meters (required)
        <input
          type="number"
          min="0.001"
          step="any"
          value={node.diameter}
          disabled={charged}
          onChange={(event) => editNode({ diameter: Number(event.target.value) })}
        />
      </label>
      {node.parent_id && (
        <label>
          Parent
          <select
            value={node.parent_id}
            onChange={(event) => editNode({ parent_id: event.target.value })}
          >
            {draft.nodes
              .filter((entry) => !blocked.has(entry.id))
              .map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
          </select>
        </label>
      )}
      <CatalogEntityPicker
        catalog="actions"
        label="Stored Action"
        placeholder="Select from Action catalogue"
        selectedId={node.action_id}
        disabled={charged}
        options={Object.values(actions).map((entry) => ({
          id: entry.id,
          label: entry.name,
          value: entry.id
        }))}
        onSelect={(id) => editNode({ action_id: id, mana_cost_step_ids: [], power_step_ids: [] })}
      />
      <button
        disabled={charged}
        onClick={() => editNode({ action_id: null, mana_cost_step_ids: [], power_step_ids: [] })}
      >
        Clear Action
      </button>
      {action && (
        <>
          <p>
            {action.name}: {action.notes}
          </p>
          <p>Select the casting costs and spell values from the existing pipeline.</p>
          {(action.steps ?? []).map((step) => (
            <div key={step.step_id} className="sigil-step">
              <span>
                {step.step_id} · {step.type}
              </span>
              {step.type === "decrement_value" && step.path.join(".") === "mana" && (
                <label>
                  <input
                    type="checkbox"
                    disabled={charged}
                    checked={node.mana_cost_step_ids?.includes(step.step_id) ?? false}
                    onChange={(event) =>
                      editNode({
                        mana_cost_step_ids: event.target.checked
                          ? [...(node.mana_cost_step_ids ?? []), step.step_id]
                          : node.mana_cost_step_ids?.filter((id) => id !== step.step_id)
                      })
                    }
                  />
                  Mana casting cost
                </label>
              )}
              {[
                "send_roll",
                "send_message",
                "set_value",
                "increment_value",
                "decrement_value",
                "resolve_damage"
              ].includes(step.type) &&
                !node.mana_cost_step_ids?.includes(step.step_id) && (
                  <label>
                    <input
                      type="checkbox"
                      disabled={charged}
                      checked={node.power_step_ids?.includes(step.step_id) ?? false}
                      onChange={(event) =>
                        editNode({
                          power_step_ids: event.target.checked
                            ? [...(node.power_step_ids ?? []), step.step_id]
                            : node.power_step_ids?.filter((id) => id !== step.step_id)
                        })
                      }
                    />
                    Scale spell value
                  </label>
                )}
            </div>
          ))}
        </>
      )}
      <div className="sigil-controls">
        <button
          onClick={() => {
            const child = newNode(node.id);
            update([...draft.nodes, child]);
            onSelectNode(child.id);
          }}
        >
          Add sub-sigil
        </button>
        <button
          disabled={!node.parent_id}
          onClick={() => update(duplicateBranch(draft.nodes, node.id))}
        >
          Duplicate branch
        </button>
        <button
          disabled={!node.parent_id}
          onClick={() => update(reorderNode(draft.nodes, node.id, -1))}
        >
          Move up
        </button>
        <button
          disabled={!node.parent_id}
          onClick={() => update(reorderNode(draft.nodes, node.id, 1))}
        >
          Move down
        </button>
        <button
          disabled={!node.parent_id}
          onClick={() => {
            if (
              confirmDestructiveAction({
                action: "Remove",
                subject: node.name,
                consequence: "This branch will be removed when configuration is saved."
              })
            ) {
              update(draft.nodes.filter((entry) => !blocked.has(entry.id)));
              onSelectNode(node.parent_id ?? null);
            }
          }}
        >
          Remove branch
        </button>
      </div>
      {role === "gm" && (
        <label>
          Characters allowed to access
          <select
            multiple
            value={draft.access_instance_ids ?? []}
            onChange={(event) => {
              onChangeDraft({
                ...draft,
                access_instance_ids: Array.from(
                  event.target.selectedOptions,
                  (option) => option.value
                )
              });
            }}
          >
            {Object.keys(persistentSheets)
              .filter((id) => id !== draft.owner_instance_id)
              .map((id) => (
                <option key={id} value={id}>
                  {actorName(id)}
                </option>
              ))}
          </select>
        </label>
      )}
    </fieldset>
  );
}
