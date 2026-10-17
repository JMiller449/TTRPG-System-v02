import { Field } from "@/shared/ui/Field";
import { useAppStore } from "@/app/state/useAppStore";
import type { SigilPayload } from "@/generated/backendProtocol";

export function SigilItemBinding({
  sigil,
  disabled,
  onChange
}: {
  sigil: SigilPayload;
  disabled: boolean;
  onChange: (relationshipId: string | null) => void;
}): JSX.Element {
  const { state } = useAppStore();
  const inventory = state.serverState.persistentSheets[sigil.owner_instance_id]?.items ?? {};
  return (
    <Field label="Attach to inventory item (optional)">
      <select
        value={sigil.item_relationship_id ?? ""}
        disabled={disabled || sigil.nodes.some((node) => node.charge)}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <option value="">Standalone sigil</option>
        {sigil.item_relationship_id && !inventory[sigil.item_relationship_id] && (
          <option value={sigil.item_relationship_id} disabled>
            Unavailable item · {sigil.item_relationship_id}
          </option>
        )}
        {Object.entries(inventory).map(([id, bridge]) => (
          <option
            key={id}
            value={id}
            disabled={bridge.count !== 1 || !state.serverState.items[bridge.item_id]}
          >
            {state.serverState.items[bridge.item_id]?.name ?? bridge.item_id} · {id}
            {bridge.count !== 1 ? " · requires one item copy" : ""}
          </option>
        ))}
      </select>
      <span className="muted">
        The charged Action and charge status appear on this item copy. Discharge before changing the
        attachment.
      </span>
    </Field>
  );
}
