import type {
  ActionDefinition,
  ItemDefinition,
  ProficiencyDefinition
} from "@/domain/models";
import type {
  TemplateActionAssignment,
  TemplateEditorValues,
  TemplateItemAssignment,
  TemplateProficiencyAssignment
} from "@/features/sheets/templateEditorTypes";
import { Field } from "@/shared/ui/Field";
import { SearchPopoverPicker } from "@/shared/ui/SearchPopoverPicker";
import type { SearchPopoverOption } from "@/shared/ui/searchPopover";
import { makeId } from "@/shared/utils/id";

function orderedRecords<T>(records: Record<string, T>, order: string[]): T[] {
  return order.map((id) => records[id]).filter((entry): entry is T => Boolean(entry));
}

function AssignmentEmpty({ children }: { children: string }): JSX.Element {
  return <p className="template-builder__assignment-empty muted">{children}</p>;
}

export function TemplateActionsSection({
  values,
  actions,
  actionOrder,
  onChange
}: {
  values: TemplateEditorValues;
  actions: Record<string, ActionDefinition>;
  actionOrder: string[];
  onChange: (next: TemplateEditorValues) => void;
}): JSX.Element {
  const assignedIds = new Set(values.actions.map((entry) => entry.actionId));
  const options: SearchPopoverOption<ActionDefinition>[] = orderedRecords(
    actions,
    actionOrder
  ).map((action) => ({
    id: action.id,
    label: action.name,
    secondary: action.roll_mode_kind === "none" ? "No roll mode" : action.roll_mode_kind,
    keywords: [action.id, action.notes ?? ""],
    disabledReason: assignedIds.has(action.id) ? "Already assigned" : undefined,
    value: action
  }));

  return (
    <section className="template-builder__section stack" aria-labelledby="template-actions-title">
      <div>
        <h3 id="template-actions-title">Actions</h3>
        <p className="muted">Assign global actions. Action definitions remain managed in Action Authoring.</p>
      </div>
      <SearchPopoverPicker
        label="Add Action"
        placeholder="Search action definitions"
        options={options}
        emptyMessage="No actions match."
        onSelect={(action) =>
          onChange({
            ...values,
            actions: [
              ...values.actions,
              { relationshipId: makeId("sheet_action"), actionId: action.id }
            ]
          })
        }
      />
      {values.actions.length === 0 ? (
        <AssignmentEmpty>Backend baseline actions will be attached when this template is created.</AssignmentEmpty>
      ) : (
        <div className="template-builder__assignment-list">
          {values.actions.map((entry) => {
            const action = actions[entry.actionId];
            return (
              <article className="template-builder__assignment-row" key={entry.relationshipId}>
                <div>
                  <strong>{action?.name ?? entry.actionId}</strong>
                  <span className="muted">{action?.roll_mode_kind ?? "Missing definition"}</span>
                </div>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() =>
                    onChange({
                      ...values,
                      actions: values.actions.filter(
                        (candidate) => candidate.relationshipId !== entry.relationshipId
                      )
                    })
                  }
                >
                  Remove
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function updateProficiency(
  entries: TemplateProficiencyAssignment[],
  relationshipId: string,
  changes: Partial<TemplateProficiencyAssignment>
): TemplateProficiencyAssignment[] {
  return entries.map((entry) =>
    entry.relationshipId === relationshipId ? { ...entry, ...changes } : entry
  );
}

export function TemplateProficienciesSection({
  values,
  proficiencies,
  proficiencyOrder,
  onChange
}: {
  values: TemplateEditorValues;
  proficiencies: Record<string, ProficiencyDefinition>;
  proficiencyOrder: string[];
  onChange: (next: TemplateEditorValues) => void;
}): JSX.Element {
  const assignedIds = new Set(values.proficiencies.map((entry) => entry.proficiencyId));
  const options: SearchPopoverOption<ProficiencyDefinition>[] = orderedRecords(
    proficiencies,
    proficiencyOrder
  ).map((proficiency) => ({
    id: proficiency.id,
    label: proficiency.name,
    secondary: proficiency.description,
    keywords: [proficiency.id],
    disabledReason: assignedIds.has(proficiency.id) ? "Already assigned" : undefined,
    value: proficiency
  }));

  return (
    <section
      className="template-builder__section stack"
      aria-labelledby="template-proficiencies-title"
    >
      <div>
        <h3 id="template-proficiencies-title">Proficiencies</h3>
        <p className="muted">Assign definitions with starting use count and growth per use.</p>
      </div>
      <SearchPopoverPicker
        label="Add Proficiency"
        placeholder="Search proficiency definitions"
        options={options}
        emptyMessage="No proficiencies match."
        onSelect={(proficiency) =>
          onChange({
            ...values,
            proficiencies: [
              ...values.proficiencies,
              {
                relationshipId: makeId("sheet_proficiency"),
                proficiencyId: proficiency.id,
                useCount: "0",
                growthRate: "1"
              }
            ]
          })
        }
      />
      {values.proficiencies.length === 0 ? (
        <AssignmentEmpty>No starting proficiencies assigned.</AssignmentEmpty>
      ) : (
        <div className="template-builder__assignment-list">
          {values.proficiencies.map((entry) => {
            const proficiency = proficiencies[entry.proficiencyId];
            return (
              <article
                className="template-builder__assignment-row template-builder__assignment-row--editable"
                key={entry.relationshipId}
              >
                <div>
                  <strong>{proficiency?.name ?? entry.proficiencyId}</strong>
                  <span className="muted">{proficiency?.description ?? "Missing definition"}</span>
                </div>
                <Field label="Starting Uses">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={entry.useCount}
                    onChange={(event) =>
                      onChange({
                        ...values,
                        proficiencies: updateProficiency(
                          values.proficiencies,
                          entry.relationshipId,
                          { useCount: event.target.value }
                        )
                      })
                    }
                  />
                </Field>
                <Field label="Growth Per Use">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={entry.growthRate}
                    onChange={(event) =>
                      onChange({
                        ...values,
                        proficiencies: updateProficiency(
                          values.proficiencies,
                          entry.relationshipId,
                          { growthRate: event.target.value }
                        )
                      })
                    }
                  />
                </Field>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() =>
                    onChange({
                      ...values,
                      proficiencies: values.proficiencies.filter(
                        (candidate) => candidate.relationshipId !== entry.relationshipId
                      )
                    })
                  }
                >
                  Remove
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function updateItem(
  entries: TemplateItemAssignment[],
  relationshipId: string,
  changes: Partial<TemplateItemAssignment>
): TemplateItemAssignment[] {
  return entries.map((entry) =>
    entry.relationshipId === relationshipId ? { ...entry, ...changes } : entry
  );
}

export function TemplateInventorySection({
  values,
  items,
  itemOrder,
  onChange
}: {
  values: TemplateEditorValues;
  items: Record<string, ItemDefinition>;
  itemOrder: string[];
  onChange: (next: TemplateEditorValues) => void;
}): JSX.Element {
  const assignedIds = new Set(values.items.map((entry) => entry.itemId));
  const options: SearchPopoverOption<ItemDefinition>[] = orderedRecords(items, itemOrder).map(
    (item) => ({
      id: item.id,
      label: item.name,
      secondary: item.interaction_type.replace("_", " "),
      keywords: [item.id, item.category ?? "", item.description],
      disabledReason: assignedIds.has(item.id) ? "Already in starting inventory" : undefined,
      value: item
    })
  );

  return (
    <section
      className="template-builder__section stack"
      aria-labelledby="template-inventory-title"
    >
      <div>
        <h3 id="template-inventory-title">Starting Inventory &amp; Equipment</h3>
        <p className="muted">Attach item definitions with starting quantity and equipped state.</p>
      </div>
      <SearchPopoverPicker
        label="Add Item"
        placeholder="Search item definitions"
        options={options}
        emptyMessage="No items match."
        onSelect={(item) =>
          onChange({
            ...values,
            items: [
              ...values.items,
              {
                relationshipId: makeId("sheet_item"),
                itemId: item.id,
                count: "1",
                equipped: false
              }
            ]
          })
        }
      />
      {values.items.length === 0 ? (
        <AssignmentEmpty>No starting inventory assigned.</AssignmentEmpty>
      ) : (
        <div className="template-builder__assignment-list">
          {values.items.map((entry) => {
            const item = items[entry.itemId];
            const equippable = item?.interaction_type === "equippable";
            return (
              <article
                className="template-builder__assignment-row template-builder__assignment-row--editable"
                key={entry.relationshipId}
              >
                <div>
                  <strong>{item?.name ?? entry.itemId}</strong>
                  <span className="muted">
                    {item?.interaction_type.replace("_", " ") ?? "Missing definition"}
                  </span>
                </div>
                <Field label="Quantity">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={entry.count}
                    onChange={(event) =>
                      onChange({
                        ...values,
                        items: updateItem(values.items, entry.relationshipId, {
                          count: event.target.value,
                          equipped: Number(event.target.value) > 0 ? entry.equipped : false
                        })
                      })
                    }
                  />
                </Field>
                <label className="template-builder__equipped-toggle">
                  <input
                    type="checkbox"
                    checked={entry.equipped}
                    disabled={!equippable || Number(entry.count) <= 0}
                    onChange={(event) =>
                      onChange({
                        ...values,
                        items: updateItem(values.items, entry.relationshipId, {
                          equipped: event.target.checked
                        })
                      })
                    }
                  />
                  Equipped
                </label>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() =>
                    onChange({
                      ...values,
                      items: values.items.filter(
                        (candidate) => candidate.relationshipId !== entry.relationshipId
                      )
                    })
                  }
                >
                  Remove
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export type { TemplateActionAssignment };
