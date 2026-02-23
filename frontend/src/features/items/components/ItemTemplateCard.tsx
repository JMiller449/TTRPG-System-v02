import type { ItemTemplate } from "@/domain/models";

export function ItemTemplateCard({
  item,
  onEdit,
  onDelete
}: {
  item: ItemTemplate;
  onEdit: () => void;
  onDelete: () => void;
}): JSX.Element {
  return (
    <article className="list-item list-item--block item-template-card">
      <div className="list-item__top">
        <strong>{item.name}</strong>
        <span className="muted">{new Date(item.updatedAt).toLocaleDateString()}</span>
      </div>
      <div className="muted">
        {item.type} · Rank {item.rank} · Weight {item.weight} · Value {item.value}
      </div>
      <div className="muted">Immediate Effects: {item.immediateEffects || "(none)"}</div>
      <div className="muted">Non-Immediate Effects: {item.nonImmediateEffects || "(none)"}</div>
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
