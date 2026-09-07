import type { FormulaDefinition } from "@/domain/models";

export function ActionSharedFormulaSource({
  formulaId,
  definition,
  onCustomize
}: {
  formulaId: string;
  definition: FormulaDefinition | null;
  onCustomize: () => void;
}): JSX.Element {
  return (
    <section className="action-shared-formula" aria-label="Shared formula">
      <div className="action-shared-formula__content">
        <span className="action-shared-formula__heading">
          <strong>Shared formula</strong>
          <code>{formulaId}</code>
        </span>
        {definition ? (
          <code className="action-shared-formula__expression">{definition.formula.text}</code>
        ) : (
          <span className="muted">This formula has been deleted from the catalog.</span>
        )}
      </div>
      <button
        className="button button--secondary"
        type="button"
        disabled={!definition}
        onClick={onCustomize}
      >
        Customize for this action
      </button>
    </section>
  );
}
