import type { StandaloneEffectDefinition } from "@/domain/models";
import {
  augmentationEffectUsesTarget,
  formatAugmentationEffect,
  formatFormulaModifierSelector
} from "@/features/augmentations/augmentationEditorValues";

function formatTarget(effect: StandaloneEffectDefinition): string {
  return `${effect.target.root}.${effect.target.path.join(".")}`;
}

export function StandaloneEffectList({
  effects,
  onEdit,
  onDelete
}: {
  effects: StandaloneEffectDefinition[];
  onEdit: (effect: StandaloneEffectDefinition) => void;
  onDelete: (effectId: string) => void;
}): JSX.Element {
  return (
    <section className="stack">
      <h3 className="template-editor__title">Authored Effects</h3>
      {effects.length === 0 ? <p className="empty-state">No action-controlled effects.</p> : null}
      <div className="list">
        {effects.map((effect) => (
          <article
            className="list-item list-item--block augmentation-template-card"
            key={effect.id}
          >
            <div className="list-item__top">
              <strong>{effect.name}</strong>
              <span className="muted">{(effect.active ?? true) ? "available" : "disabled"}</span>
            </div>
            {augmentationEffectUsesTarget(effect) ? (
              <div className="muted">Changes: {formatTarget(effect)}</div>
            ) : null}
            <div className="muted">Behavior: {formatAugmentationEffect(effect)}</div>
            {effect.effect.type !== "formula_modifier" ? (
              <div className="muted">Applies to: {formatFormulaModifierSelector(effect)}</div>
            ) : null}
            {effect.description ? (
              <p className="item-definition-card__description">{effect.description}</p>
            ) : null}
            <div className="inline-actions">
              <button
                className="button button--secondary"
                type="button"
                onClick={() => onEdit(effect)}
              >
                Edit
              </button>
              <button
                className="button button--secondary"
                type="button"
                onClick={() => onDelete(effect.id)}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
