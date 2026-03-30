import type { SheetTemplateView } from "@/domain/models";

export function TemplateListItem({
  template,
  onEdit,
  onSpawn
}: {
  template: SheetTemplateView;
  onEdit: () => void;
  onSpawn: () => void;
}): JSX.Element {
  return (
    <article className="list-item">
      <div>
        <strong>{template.name}</strong>
        <div className="muted">
          {template.kind} template · tags: {template.tags.join(", ") || "none"}
        </div>
      </div>
      <div className="inline-actions">
        <button className="button button--secondary" onClick={onEdit}>
          Edit
        </button>
        <button className="button button--secondary" onClick={onSpawn}>
          Spawn
        </button>
      </div>
    </article>
  );
}
