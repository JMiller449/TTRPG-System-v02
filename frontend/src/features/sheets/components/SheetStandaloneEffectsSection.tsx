import type { ActiveStandaloneEffect } from "@/app/state/selectors";
import { actionStepLabel } from "@/features/actions/actionStepMenu";
import {
  augmentationEffectUsesTarget,
  formatAugmentationEffect,
  formatAugmentationLifecycle,
  formatStackingSummary
} from "@/features/augmentations/augmentationEditorValues";
import { EmptyState } from "@/shared/ui/EmptyState";

function sourceLabel(effect: ActiveStandaloneEffect): string {
  const { application, sourceAction, sourceStep } = effect;
  if (application.source.type !== "action") {
    return application.source.label || "System";
  }

  const actionLabel = sourceAction?.name || application.source.id || "Unknown action";
  const stepId = application.source.relationship_id;
  if (!stepId) {
    return actionLabel;
  }
  const stepLabel = sourceStep ? actionStepLabel(sourceStep.type) : "Unknown step";
  return `${actionLabel} · ${stepLabel} (${stepId})`;
}

export function SheetStandaloneEffectsSection({
  effects
}: {
  effects: ActiveStandaloneEffect[];
}): JSX.Element {
  return (
    <section className="character-sheet__section">
      <h4>Active Effects</h4>
      <div className="list">
        {effects.length === 0 ? <EmptyState message="No active standalone effects." /> : null}
        {effects.map(({ application, definition, sourceAction, sourceStep }) => {
          const effect = { application, definition, sourceAction, sourceStep };
          const stackingSummary = formatStackingSummary(
            definition.stacking,
            application.stack_index
          );
          return (
            <article className="list-item list-item--block" key={application.application_id}>
              <div className="list-item__top">
                <strong>{definition.name}</strong>
                <span className="muted">
                  {definition.active === false ? "Definition disabled" : "Active"}
                </span>
              </div>
              {definition.description ? (
                <div className="muted">{definition.description}</div>
              ) : null}
              <div className="muted">
                Behavior: {formatAugmentationEffect(definition)}
                {augmentationEffectUsesTarget(definition)
                  ? ` on ${definition.target.root}.${definition.target.path.join(".")}`
                  : ""}
              </div>
              <div className="muted">Duration: {formatAugmentationLifecycle(definition.lifecycle)}</div>
              {stackingSummary ? <div className="muted">{stackingSummary}</div> : null}
              <div className="muted">Source: {sourceLabel(effect)}</div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
