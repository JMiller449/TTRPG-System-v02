import type { FormulaDefinition } from "@/domain/models";
import { EmptyState } from "@/shared/ui/EmptyState";
import { FormulaDefinitionCard } from "@/features/formulas/components/FormulaDefinitionCard";

export function FormulaDefinitionList({
  formulas,
  onEdit,
  onDelete
}: {
  formulas: FormulaDefinition[];
  onEdit: (formula: FormulaDefinition) => void;
  onDelete: (formulaId: string) => void;
}): JSX.Element {
  return (
    <div className="list">
      {formulas.length === 0 ? <EmptyState message="No formulas created yet." /> : null}
      {formulas.map((formula) => (
        <FormulaDefinitionCard
          key={formula.id}
          formula={formula}
          onEdit={() => onEdit(formula)}
          onDelete={() => onDelete(formula.id)}
        />
      ))}
    </div>
  );
}
