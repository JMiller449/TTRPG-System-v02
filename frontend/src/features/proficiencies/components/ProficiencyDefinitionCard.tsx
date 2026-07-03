import type { ProficiencyDefinition } from "@/domain/models";

export function ProficiencyDefinitionCard({
  proficiency,
  onEdit,
  onDelete
}: {
  proficiency: ProficiencyDefinition;
  onEdit: () => void;
  onDelete: () => void;
}): JSX.Element {
  const categoryLabel =
    proficiency.category === "weapon_family" ? "Weapon Family" : "Custom";

  return (
    <article className="list-item list-item--block proficiency-definition-card">
      <div className="list-item__top">
        <strong>{proficiency.name}</strong>
        <span className="muted">
          {proficiency.id} · {categoryLabel}
        </span>
      </div>
      <div className="muted">{proficiency.description || "(no description)"}</div>
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
