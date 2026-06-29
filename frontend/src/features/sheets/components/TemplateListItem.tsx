import type { SheetTemplateView } from "@/domain/models";

export function TemplateListItem({
  template,
  onEdit,
  onSpawn,
  onDelete
}: {
  template: SheetTemplateView;
  onEdit: () => void;
  onSpawn: () => void;
  onDelete: () => void;
}): JSX.Element {
  return (
    <article className="list-item">
      <div>
        <strong>{template.name}</strong>
        <div className="muted">{template.kind} template</div>
      </div>
      <div className="inline-actions">
        <button className="button button--secondary" onClick={onEdit}>
          Edit
        </button>
        <button className="button button--secondary" onClick={onSpawn}>
          Spawn
        </button>
        <button
          className="button button--secondary"
          aria-label={`Delete template ${template.name}`}
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </article>
  );
}
