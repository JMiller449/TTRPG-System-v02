import type { FormulaDefinition } from "@/domain/models";

function formulaAliasSummary(formula: FormulaDefinition): string {
  const aliases = formula.formula.aliases ?? [];
  return aliases.length > 0
    ? aliases.map((alias) => `${alias.name}: ${alias.path.join(".")}`).join(", ")
    : "(none)";
}

export function FormulaDefinitionCard({
  formula,
  onEdit,
  onDelete
}: {
  formula: FormulaDefinition;
  onEdit: () => void;
  onDelete: () => void;
}): JSX.Element {
  return (
    <article className="list-item list-item--block formula-definition-card">
      <div className="list-item__top">
        <strong>{formula.id}</strong>
      </div>
      <div className="muted">Formula: {formula.formula.text}</div>
      <div className="muted">Aliases: {formulaAliasSummary(formula)}</div>
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
