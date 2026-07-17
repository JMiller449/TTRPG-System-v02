import type { ActionDefinition, ActionStep, AttributeDefinition } from "@/domain/models";
import { SheetAttributesSection } from "@/features/sheets/components/SheetAttributesSection";

function stepSummary(step: ActionStep): string {
  switch (step.type) {
    case "send_message":
      return `${step.step_id}: send ${step.visibility === "gm" ? "GM" : "public"} message`;
    case "send_roll":
      return `${step.step_id}: send ${step.visibility === "gm" ? "GM" : "public"} ${step.presentation ?? "default"} roll`;
    case "calculate_value":
      return `${step.step_id}: calculate ${step.variable_id}`;
    case "set_value":
      return `${step.step_id}: set ${step.path.join(".")}`;
    case "increment_value":
      return `${step.step_id}: increment ${step.path.join(".")}`;
    case "decrement_value":
      return `${step.step_id}: decrement ${step.path.join(".")}`;
    case "resolve_damage":
      return `${step.step_id}: resolve ${step.damage_type} damage`;
    case "gain_proficiency_use":
      return `${step.step_id}: gain proficiency use`;
    case "apply_augmentation":
      return `${step.step_id}: ${step.operation ?? "apply"} augmentation`;
    case "apply_condition_preset":
      return `${step.step_id}: ${step.operation ?? "apply"} condition`;
  }
}

export function ActionDefinitionCard({
  action,
  attributeDefinitions,
  onEdit,
  onDelete
}: {
  action: ActionDefinition;
  attributeDefinitions: Record<string, AttributeDefinition>;
  onEdit: () => void;
  onDelete: () => void;
}): JSX.Element {
  const steps = action.steps ?? [];

  return (
    <article className="list-item list-item--block action-definition-card">
      <div className="list-item__top">
        <strong>{action.name}</strong>
        <span className="muted">{action.id}</span>
      </div>
      {action.notes ? <div className="muted">Notes: {action.notes}</div> : null}
      <div className="muted">Roll mode: {action.roll_mode_kind ?? "none"}</div>
      <div className="muted">Steps: {steps.length}</div>
      {steps.length > 0 ? (
        <div className="list">
          {steps.map((step) => (
            <div className="muted" key={step.step_id}>
              {stepSummary(step)}
            </div>
          ))}
        </div>
      ) : null}
      {Object.keys(action.attributes ?? {}).length > 0 ? (
        <SheetAttributesSection
          definitions={attributeDefinitions}
          bridges={action.attributes ?? {}}
          canEdit={false}
          subjectType="action"
          onSaveFormula={() => undefined}
          onReset={() => undefined}
        />
      ) : null}
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
