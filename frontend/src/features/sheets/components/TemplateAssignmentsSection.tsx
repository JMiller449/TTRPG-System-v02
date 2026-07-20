import type { ActionDefinition, ItemDefinition, ProficiencyDefinition } from "@/domain/models";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import type {
  TemplateActionAssignment,
  TemplateEditorValues,
  TemplateItemAssignment,
  TemplateProficiencyAssignment
} from "@/features/sheets/templateEditorTypes";
import { Field } from "@/shared/ui/Field";
import { confirmDestructiveAction } from "@/shared/ui/confirmDestructiveAction";
import { SearchPopoverPicker } from "@/shared/ui/SearchPopoverPicker";
import type { SearchPopoverOption } from "@/shared/ui/searchPopover";
import { makeId } from "@/shared/utils/id";
import type { TemplateContextualEntityKind } from "@/features/sheets/templateContextualAuthoring";

function orderedRecords<T>(records: Record<string, T>, order: string[]): T[] {
  return order.map((id) => records[id]).filter((entry): entry is T => Boolean(entry));
}

function AssignmentEmpty({ title, children }: { title: string; children: string }): JSX.Element {
  return (
    <div className="template-builder__assignment-empty">
      <strong>{title}</strong>
      <span className="muted">{children}</span>
    </div>
  );
}

export function TemplateActionsSection({
  values,
  actions,
  actionOrder,
  defaultActions,
  onCreateNew,
  onChange
}: {
  values: TemplateEditorValues;
  actions: Record<string, ActionDefinition>;
  actionOrder: string[];
  defaultActions: NonNullable<ActionFormulaAuthoringMetadata["default_sheet_actions"]>;
  onCreateNew?: (kind: TemplateContextualEntityKind) => void;
  onChange: (next: TemplateEditorValues) => void;
}): JSX.Element {
  const assignedIds = new Set(values.actions.map((entry) => entry.actionId));
  const defaultActionIds = new Set(defaultActions.map((entry) => entry.action_id));
  const extraAssignments = values.actions.filter((entry) => !defaultActionIds.has(entry.actionId));
  const options: SearchPopoverOption<ActionDefinition>[] = orderedRecords(actions, actionOrder).map(
    (action) => ({
      id: action.id,
      label: action.name,
      secondary: action.roll_mode_kind === "none" ? "No roll mode" : action.roll_mode_kind,
      keywords: [action.id, action.notes ?? ""],
      disabledReason: defaultActionIds.has(action.id)
        ? "Included automatically"
        : assignedIds.has(action.id)
          ? "Already assigned"
          : undefined,
      value: action
    })
  );

  return (
    <section className="template-builder__section stack" aria-labelledby="template-actions-title">
      <div className="template-builder__section-heading">
        <div>
          <h3 id="template-actions-title">Actions</h3>
          <p className="muted">
            Choose what this character or enemy can do. Standard system actions are added
            automatically, so this section can stay empty.
          </p>
        </div>
        {onCreateNew ? (
          <button
            type="button"
            className="button button--secondary"
            onClick={() => onCreateNew("action")}
          >
            Create reusable Action…
          </button>
        ) : null}
      </div>
      <SearchPopoverPicker
        label="Add Action"
        placeholder="Search available actions"
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
      {defaultActions.length > 0 ? (
        <div className="stack" aria-label="Actions included automatically">
          <div>
            <strong>Included on every sheet</strong>
            <p className="muted">
              These system actions are always attached and cannot be added twice or removed here.
            </p>
          </div>
          <div className="template-builder__assignment-list">
            {defaultActions.map((action) => (
              <article className="template-builder__assignment-row" key={action.action_id}>
                <div>
                  <strong>{action.name}</strong>
                  <span className="muted">{action.description}</span>
                </div>
                <span className="pill pill--resolved">Always included</span>
              </article>
            ))}
          </div>
        </div>
      ) : null}
      {extraAssignments.length === 0 ? (
        <AssignmentEmpty title="No extra starting actions">
          Add only campaign or character-specific actions beyond the included system actions above.
        </AssignmentEmpty>
      ) : (
        <div className="template-builder__assignment-list">
          {extraAssignments.map((entry) => {
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
                  onClick={() => {
                    if (
                      !confirmDestructiveAction({
                        action: "Remove",
                        subject: action?.name ?? entry.actionId,
                        consequence:
                          "This removes the action from the template draft when you save it."
                      })
                    ) {
                      return;
                    }
                    onChange({
                      ...values,
                      actions: values.actions.filter(
                        (candidate) => candidate.relationshipId !== entry.relationshipId
                      )
                    });
                  }}
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
  onCreateNew,
  onChange
}: {
  values: TemplateEditorValues;
  proficiencies: Record<string, ProficiencyDefinition>;
  proficiencyOrder: string[];
  onCreateNew?: (kind: TemplateContextualEntityKind) => void;
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
      <div className="template-builder__section-heading">
        <div>
          <h3 id="template-proficiencies-title">Proficiencies</h3>
          <p className="muted">
            Add trained skills, weapons, spells, or campaign knowledge. Starting uses represent
            prior practice; growth controls how much each future use adds.
          </p>
        </div>
        {onCreateNew ? (
          <button
            type="button"
            className="button button--secondary"
            onClick={() => onCreateNew("proficiency")}
          >
            Create reusable Proficiency…
          </button>
        ) : null}
      </div>
      <SearchPopoverPicker
        label="Add Proficiency"
        placeholder="Search available proficiencies"
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
        <AssignmentEmpty title="No starting proficiencies">
          This is valid. Add only training that the template should begin with.
        </AssignmentEmpty>
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
                <Field label="Starting use count">
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
                <Field label="Growth per use">
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
                  onClick={() => {
                    if (
                      !confirmDestructiveAction({
                        action: "Remove",
                        subject: proficiency?.name ?? entry.proficiencyId,
                        consequence:
                          "This removes the proficiency assignment from the template draft when you save it."
                      })
                    ) {
                      return;
                    }
                    onChange({
                      ...values,
                      proficiencies: values.proficiencies.filter(
                        (candidate) => candidate.relationshipId !== entry.relationshipId
                      )
                    });
                  }}
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
  onCreateNew,
  onChange
}: {
  values: TemplateEditorValues;
  items: Record<string, ItemDefinition>;
  itemOrder: string[];
  onCreateNew?: (kind: TemplateContextualEntityKind) => void;
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
    <section className="template-builder__section stack" aria-labelledby="template-inventory-title">
      <div className="template-builder__section-heading">
        <div>
          <h3 id="template-inventory-title">Starting Inventory &amp; Equipment</h3>
          <p className="muted">
            Add items that every new character created from this template should receive. Items can
            be carried or start equipped.
          </p>
        </div>
        {onCreateNew ? (
          <button
            type="button"
            className="button button--secondary"
            onClick={() => onCreateNew("item")}
          >
            Create reusable Item…
          </button>
        ) : null}
      </div>
      <SearchPopoverPicker
        label="Add Item"
        placeholder="Search available items"
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
        <AssignmentEmpty title="No starting inventory">
          This is valid. Items can also be added to a character after the template is created.
        </AssignmentEmpty>
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
                  onClick={() => {
                    if (
                      !confirmDestructiveAction({
                        action: "Remove",
                        subject: item?.name ?? entry.itemId,
                        consequence:
                          "This removes the starting inventory assignment from the template draft when you save it."
                      })
                    ) {
                      return;
                    }
                    onChange({
                      ...values,
                      items: values.items.filter(
                        (candidate) => candidate.relationshipId !== entry.relationshipId
                      )
                    });
                  }}
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
