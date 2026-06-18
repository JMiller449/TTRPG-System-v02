import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import { EmptyState } from "@/shared/ui/EmptyState";

export function ActionStepMetadataPanel({
  metadata
}: {
  metadata: ActionFormulaAuthoringMetadata | null;
}): JSX.Element {
  const actionSteps = metadata?.action_steps ?? [];

  return (
    <div className="template-editor action-metadata-panel">
      <p className="template-editor__title">Action Step Metadata</p>
      <div className="list">
        {!metadata ? <EmptyState message="Action metadata not loaded yet." /> : null}
        {metadata && actionSteps.length === 0 ? <EmptyState message="No action step metadata available." /> : null}
        {actionSteps.map((step) => (
          <article className="list-item list-item--block" key={step.type}>
            <div className="list-item__top">
              <strong>{step.label}</strong>
              <span className="muted">{step.type}</span>
            </div>
            <div className="muted">Category: {step.category}</div>
            <div className="muted">
              Formula Fields: {step.formula_fields.length > 0 ? step.formula_fields.join(", ") : "(none)"}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
