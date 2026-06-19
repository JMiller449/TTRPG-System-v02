import type { ItemDefinition } from "@/domain/models";
import { toItemEditorValues } from "@/features/items/itemEditorValues";

export function ItemDefinitionCard({
  item,
  onEdit,
  onDelete
}: {
  item: ItemDefinition;
  onEdit: () => void;
  onDelete: () => void;
}): JSX.Element {
  const preview = toItemEditorValues(item);
  const augmentationCount = item.augmentation_templates?.length ?? 0;

  return (
    <article className="list-item list-item--block item-definition-card">
      <div className="list-item__top">
        <strong>{item.name}</strong>
        {item.world_anvil_url ? (
          <a className="muted" href={item.world_anvil_url} target="_blank" rel="noreferrer">
            World Anvil
          </a>
        ) : null}
      </div>
      <div className="muted">
        {preview.type || "Item"} · Rank {preview.rank} · Weight {item.weight || "(none)"} · Price {item.price || "(none)"}
      </div>
      <div className="muted">Immediate Effects: {preview.immediateEffects || "(none)"}</div>
      <div className="muted">Non-Immediate Effects: {preview.nonImmediateEffects || "(none)"}</div>
      <div className="muted">Augmentations: {augmentationCount}</div>
      {item.gm_notes ? <div className="muted">GM Notes: {item.gm_notes}</div> : null}
      {item.gm_special_properties ? (
        <div className="muted">GM Special Properties: {item.gm_special_properties}</div>
      ) : null}
      <div className="inline-actions">
        <button className="button button--secondary" onClick={onEdit}>
          Edit
        </button>
        <button className="button button--secondary" onClick={onDelete}>
          Delete
        </button>
      </div>
    </article>
  );
}
