import type { ActionDefinition } from "@/domain/models";
import type { ItemSigilNode } from "./sigilItemActions";

export function ItemSigilControls({
  entries,
  actions,
  pending = false,
  available,
  onActivate,
  onRecharge
}: {
  entries: ItemSigilNode[];
  actions: Record<string, ActionDefinition>;
  pending?: boolean;
  available: boolean;
  onActivate?: (sigilId: string, nodeId: string) => void;
  onRecharge?: (sigilId: string, nodeId: string) => void;
}): JSX.Element | null {
  if (!entries.length) return null;
  return (
    <div className="equipment-sigil-controls" aria-label="Item sigils">
      {entries.map(({ sigilId, sigilName, node }) => {
        const action = node.action_id ? actions[node.action_id] : undefined;
        const charged = Boolean(node.charge);
        return (
          <div key={`${sigilId}:${node.id}`} className="equipment-sigil-controls__node">
            <strong>{action?.name ?? "Unavailable Action"}</strong>
            <span>
              {sigilName} · {node.name}
            </span>
            <span role="status">{charged ? "Charged" : "Uncharged"}</span>
            {onActivate && (
              <button
                type="button"
                className="button button--secondary"
                disabled={!charged || !action || !available || pending}
                onClick={() => onActivate(sigilId, node.id)}
              >
                Activate {action?.name ?? "sigil"}
              </button>
            )}
            {onRecharge && (
              <button
                type="button"
                className="button button--secondary"
                disabled={charged || !action || !available || pending}
                onClick={() => onRecharge(sigilId, node.id)}
              >
                {node.last_imbuer_instance_id ? "Recharge sigil" : "Imbue sigil"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
