import type { ActionDefinition, ItemInteractionType } from "@/domain/models";
import type {
  ItemActionGrantEditorValues,
  ItemEditorValues
} from "@/features/items/itemEditorValues";
import { Field } from "@/shared/ui/Field";

function actionSectionTitle(interactionType: ItemInteractionType): string {
  return interactionType === "consumable" ? "Use Actions" : "Equipped Actions";
}

function createGrant(interactionType: ItemInteractionType): ItemActionGrantEditorValues {
  return {
    actionId: "",
    availability: interactionType === "consumable" ? "carried" : "equipped",
    consumeQuantity: interactionType === "consumable" ? "1" : "0"
  };
}

export function ItemActionGrantEditor({
  values,
  actions,
  onChange,
  onOpenActionAuthoring
}: {
  values: ItemEditorValues;
  actions: ActionDefinition[];
  onChange: (values: ItemEditorValues) => void;
  onOpenActionAuthoring: () => void;
}): JSX.Element {
  const isConsumable = values.interactionType === "consumable";

  return (
    <section className="item-mechanics-section stack">
      <div className="item-section-heading">
        <h3>{actionSectionTitle(values.interactionType)}</h3>
        <div className="inline-actions">
          <button
            className="button button--secondary"
            type="button"
            onClick={onOpenActionAuthoring}
          >
            Open Action Authoring
          </button>
          <button
            className="button button--secondary"
            type="button"
            onClick={() =>
              onChange({
                ...values,
                actionGrants: [...values.actionGrants, createGrant(values.interactionType)]
              })
            }
          >
            Add Action
          </button>
        </div>
      </div>

      {values.actionGrants.length === 0 ? (
        <p className="muted">No {isConsumable ? "use" : "equipped"} actions.</p>
      ) : null}
      {values.actionGrants.map((grant, index) => (
        <div className="item-action-row" key={`${grant.actionId}-${index}`}>
          <Field label={isConsumable ? "Use Action" : "Equipped Action"}>
            <select
              value={grant.actionId}
              onChange={(event) => {
                const actionGrants = [...values.actionGrants];
                actionGrants[index] = { ...grant, actionId: event.target.value };
                onChange({ ...values, actionGrants });
              }}
            >
              <option value="">Select action</option>
              {actions.map((action) => (
                <option key={action.id} value={action.id}>
                  {action.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quantity Consumed">
            <input
              type="number"
              min={isConsumable ? "1" : "0"}
              step="1"
              value={grant.consumeQuantity}
              onChange={(event) => {
                const actionGrants = [...values.actionGrants];
                actionGrants[index] = {
                  ...grant,
                  availability: isConsumable ? "carried" : "equipped",
                  consumeQuantity: event.target.value
                };
                onChange({ ...values, actionGrants });
              }}
            />
          </Field>
          <button
            className="button button--secondary item-action-row__remove"
            type="button"
            onClick={() =>
              onChange({
                ...values,
                actionGrants: values.actionGrants.filter((_, grantIndex) => grantIndex !== index)
              })
            }
          >
            Remove
          </button>
        </div>
      ))}
    </section>
  );
}
