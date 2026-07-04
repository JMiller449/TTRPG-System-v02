import { useEffect, useMemo, useState } from "react";
import type { AssignedSheetAction } from "@/app/state/selectors";
import type { ActionDefinition, FactDefinition } from "@/domain/models";
import { SheetFactsSection } from "@/features/sheets/components/SheetFactsSection";
import { actionRollModes } from "@/features/rolls/actionRollModes";
import { RollModeControl } from "@/features/rolls/RollModeControl";
import {
  selectAvailableOrderedSheetActions,
  selectExplicitAssignedSheetActionIds,
  selectOrderedSheetActions,
  toSheetActionBridgePayload
} from "@/features/sheets/sheetActions";
import type { ActionRollMode, SheetActionBridgePayload } from "@/infrastructure/ws/requestBuilders";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Field } from "@/shared/ui/Field";
import { makeId } from "@/shared/utils/id";

export function SheetActionsSection({
  assignedActions,
  actionDefinitions,
  factDefinitions,
  actionOrder,
  canEdit,
  compact = false,
  onCreate,
  onUpdate,
  onDelete,
  onPerformAction
}: {
  assignedActions: AssignedSheetAction[];
  actionDefinitions: Record<string, ActionDefinition>;
  factDefinitions: Record<string, FactDefinition>;
  actionOrder: string[];
  canEdit: boolean;
  compact?: boolean;
  onCreate: (bridge: SheetActionBridgePayload) => void;
  onUpdate: (relationshipId: string, bridge: SheetActionBridgePayload) => void;
  onDelete: (relationshipId: string) => void;
  onPerformAction: (action: AssignedSheetAction, rollMode: ActionRollMode) => void;
}): JSX.Element {
  const [rollModes, setRollModes] = useState<Record<string, ActionRollMode>>({});
  const [commandRollMode, setCommandRollMode] = useState<ActionRollMode>("normal");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"all" | "check" | "damage" | "item">("all");
  const [selectedActionId, setSelectedActionId] = useState("");
  const [draftActionIds, setDraftActionIds] = useState<Record<string, string>>({});
  const orderedActions = useMemo(
    () => selectOrderedSheetActions(actionDefinitions, actionOrder),
    [actionDefinitions, actionOrder]
  );
  const assignedExplicitActionIds = useMemo(
    () => selectExplicitAssignedSheetActionIds(assignedActions),
    [assignedActions]
  );
  const availableActions = useMemo(
    () => selectAvailableOrderedSheetActions(orderedActions, assignedExplicitActionIds),
    [assignedExplicitActionIds, orderedActions]
  );
  const availableActionIds = availableActions.map((action) => action.id).join("|");

  useEffect(() => {
    setSelectedActionId((current) =>
      availableActions.some((action) => action.id === current)
        ? current
        : (availableActions[0]?.id ?? "")
    );
  }, [availableActionIds, availableActions]);

  const createAssignment = (): void => {
    if (!selectedActionId) {
      return;
    }
    onCreate(toSheetActionBridgePayload(makeId("action_bridge"), selectedActionId));
  };

  if (!canEdit || compact) {
    const query = search.trim().toLowerCase();
    const visibleActions = assignedActions.filter((entry) => {
      const categoryMatches =
        category === "all" ||
        (category === "item" && Boolean(entry.sourceItemName)) ||
        (category !== "item" && (entry.action.roll_mode_kind ?? "none") === category);
      if (!categoryMatches) {
        return false;
      }
      if (!query) {
        return true;
      }
      return [entry.action.name, entry.action.notes, entry.sourceItemName]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query));
    });
    const controlModeKind =
      category === "damage" ? "damage" : category === "check" ? "check" : "check";

    return (
      <section className={`sheet-actions-section sheet-actions-section--command ${compact ? "sheet-actions-section--compact" : ""}`}>
        <div className="action-command-toolbar">
          <div className="action-command-toolbar__primary">
            <div className="action-command-toolbar__heading">
              <h4>{compact ? "Pinned Actions" : "Available Actions"}</h4>
              <span className="muted">{visibleActions.length} shown</span>
            </div>
            <div className="segment-row action-command-categories" aria-label="Action categories">
              <button
                type="button"
                className={`segment ${category === "all" ? "segment--active" : ""}`}
                onClick={() => setCategory("all")}
              >
                All
              </button>
              <button
                type="button"
                className={`segment ${category === "check" ? "segment--active" : ""}`}
                onClick={() => setCategory("check")}
              >
                Checks
              </button>
              <button
                type="button"
                className={`segment ${category === "damage" ? "segment--active" : ""}`}
                onClick={() => setCategory("damage")}
              >
                Damage
              </button>
              <button
                type="button"
                className={`segment ${category === "item" ? "segment--active" : ""}`}
                onClick={() => setCategory("item")}
              >
                Items
              </button>
            </div>
          </div>
          <div className="action-command-toolbar__mode">
            <RollModeControl
              value={
                actionRollModes(controlModeKind).includes(commandRollMode)
                  ? commandRollMode
                  : "normal"
              }
              modeKind={controlModeKind}
              onChange={setCommandRollMode}
            />
          </div>
          <Field label="Search">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find action"
              aria-label="Search assigned actions"
            />
          </Field>
        </div>

        {visibleActions.length === 0 ? (
          <EmptyState message={assignedActions.length === 0 ? "No actions assigned to this sheet." : "No actions match the current filters."} />
        ) : (
          <div className="action-command-grid">
            {visibleActions.map((entry) => {
              const allowedModes = actionRollModes(entry.action.roll_mode_kind ?? "none");
              const rollMode = allowedModes.includes(commandRollMode) ? commandRollMode : "normal";
              return (
                <button
                  key={entry.relationshipId}
                  type="button"
                  className="action-command-card"
                  onClick={() => onPerformAction(entry, rollMode)}
                  aria-label={`Perform ${entry.action.name} using ${rollMode} mode`}
                >
                  <strong>{entry.action.name}</strong>
                  <span>
                    {entry.action.notes ||
                      (entry.sourceItemName
                        ? `Granted by ${entry.sourceItemName}`
                        : `${entry.action.steps?.length ?? 0} authored steps`)}
                  </span>
                  <small>
                    {entry.sourceItemName ? `${entry.sourceItemName} · ` : ""}
                    {rollMode === "normal" ? "Roll normal" : `Roll ${rollMode}`}
                  </small>
                  {Object.keys(entry.action.facts ?? {}).length > 0 ? (
                    <span className="action-command-card__fact-count">
                      {Object.keys(entry.action.facts ?? {}).length} facts
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="sheet-actions-section">
      {canEdit ? (
        <div className="inline-group">
          <Field label="Global Action">
            <select
              value={selectedActionId}
              onChange={(event) => setSelectedActionId(event.target.value)}
            >
              {availableActions.length === 0 ? (
                <option value="">No unassigned actions</option>
              ) : null}
              {availableActions.map((action) => (
                <option key={action.id} value={action.id}>
                  {action.name}
                </option>
              ))}
            </select>
          </Field>
          <button
            type="button"
            className="button"
            onClick={createAssignment}
            disabled={!selectedActionId}
          >
            Assign Action
          </button>
        </div>
      ) : null}
      <div className="list">
        {assignedActions.length === 0 ? (
          <EmptyState message="No actions assigned to this sheet." />
        ) : null}
        {assignedActions.map((entry) => {
          const modeKind = entry.action.roll_mode_kind ?? "none";
          const allowedModes = actionRollModes(modeKind);
          const storedMode = rollModes[entry.relationshipId] ?? "normal";
          const rollMode = allowedModes.includes(storedMode) ? storedMode : "normal";
          const draftActionId = draftActionIds[entry.relationshipId] ?? entry.actionId;
          const replacementOptions = entry.bridge
            ? selectAvailableOrderedSheetActions(
                orderedActions,
                assignedExplicitActionIds,
                entry.actionId
              )
            : [];
          const canSaveReplacement =
            Boolean(entry.bridge) &&
            draftActionId !== entry.actionId &&
            Boolean(actionDefinitions[draftActionId]);
          return (
            <article className="list-item list-item--block" key={entry.relationshipId}>
              <div className="list-item__top">
                <strong>{entry.action.name}</strong>
                <span className="muted">{entry.relationshipId}</span>
              </div>
              {entry.action.notes ? <div className="muted">{entry.action.notes}</div> : null}
              {entry.sourceItemName ? (
                <div className="muted">
                  Granted by {entry.sourceItemName} ({entry.sourceItemAvailability})
                  {entry.consumeQuantity ? ` · consumes ${entry.consumeQuantity}` : ""}
                </div>
              ) : null}
              <div className="muted">Steps: {entry.action.steps?.length ?? 0}</div>
              {Object.keys(entry.action.facts ?? {}).length > 0 ? (
                <SheetFactsSection
                  definitions={factDefinitions}
                  bridges={entry.action.facts ?? {}}
                  canEdit={false}
                  subjectType="action"
                  onSaveFormula={() => undefined}
                  onReset={() => undefined}
                />
              ) : null}
              <RollModeControl
                value={rollMode}
                modeKind={modeKind}
                onChange={(mode) =>
                  setRollModes((current) => ({ ...current, [entry.relationshipId]: mode }))
                }
              />
              {canEdit && entry.bridge ? (
                <div className="inline-group">
                  <Field label="Assigned Action">
                    <select
                      value={draftActionId}
                      onChange={(event) =>
                        setDraftActionIds((current) => ({
                          ...current,
                          [entry.relationshipId]: event.target.value
                        }))
                      }
                    >
                      {replacementOptions.map((action) => (
                        <option key={action.id} value={action.id}>
                          {action.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <button
                    type="button"
                    className="button button--secondary"
                    disabled={!canSaveReplacement}
                    onClick={() => {
                      onUpdate(
                        entry.relationshipId,
                        toSheetActionBridgePayload(entry.relationshipId, draftActionId)
                      );
                      setDraftActionIds((current) => {
                        const next = { ...current };
                        delete next[entry.relationshipId];
                        return next;
                      });
                    }}
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => onDelete(entry.relationshipId)}
                  >
                    Remove
                  </button>
                </div>
              ) : null}
              <div className="inline-actions">
                <button
                  type="button"
                  className="button"
                  onClick={() => onPerformAction(entry, rollMode)}
                  aria-label={`Perform ${entry.action.name}`}
                >
                  Perform Action
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
