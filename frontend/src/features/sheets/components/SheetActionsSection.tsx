import { useEffect, useMemo, useState } from "react";
import type { AssignedSheetAction } from "@/app/state/selectors";
import type { ActionDefinition, AttributeDefinition } from "@/domain/models";
import { SheetAttributesSection } from "@/features/sheets/components/SheetAttributesSection";
import { actionRollModes } from "@/features/rolls/actionRollModes";
import { RollModeControl } from "@/features/rolls/RollModeControl";
import { ActionVisibilityControl } from "@/features/actions/components/ActionVisibilityControl";
import {
  selectAvailableOrderedSheetActions,
  selectExplicitAssignedSheetActionIds,
  selectOrderedSheetActions,
  toSheetActionBridgePayload
} from "@/features/sheets/sheetActions";
import type {
  ActionExecutionVisibility,
  ActionRollMode,
  SheetActionBridgePayload
} from "@/infrastructure/ws/requestBuilders";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Field } from "@/shared/ui/Field";
import { ModalDialog } from "@/shared/ui/ModalDialog";
import { confirmDestructiveAction } from "@/shared/ui/confirmDestructiveAction";
import { makeId } from "@/shared/utils/id";
import { CatalogEntityPicker } from "@/features/catalogs/CatalogEntityPicker";

export function SheetActionsSection({
  assignedActions,
  actionDefinitions,
  attributeDefinitions,
  actionOrder,
  canEdit,
  compact = false,
  commandLayout = false,
  pinnedActionIds = [],
  onPinnedActionIdsChange,
  onCreate,
  onOpenCreateAction,
  onUpdate,
  onDelete,
  onPerformAction
}: {
  assignedActions: AssignedSheetAction[];
  actionDefinitions: Record<string, ActionDefinition>;
  attributeDefinitions: Record<string, AttributeDefinition>;
  actionOrder: string[];
  canEdit: boolean;
  compact?: boolean;
  commandLayout?: boolean;
  pinnedActionIds?: string[];
  onPinnedActionIdsChange?: (actionRelationshipIds: string[]) => void;
  onCreate: (bridge: SheetActionBridgePayload) => void;
  onOpenCreateAction?: () => void;
  onUpdate: (relationshipId: string, bridge: SheetActionBridgePayload) => void;
  onDelete: (relationshipId: string) => void;
  onPerformAction: (
    action: AssignedSheetAction,
    rollMode: ActionRollMode,
    visibility: ActionExecutionVisibility
  ) => void;
}): JSX.Element {
  const [rollModes, setRollModes] = useState<Record<string, ActionRollMode>>({});
  const [visibilities, setVisibilities] = useState<Record<string, ActionExecutionVisibility>>({});
  const [commandRollMode, setCommandRollMode] = useState<ActionRollMode>("normal");
  const [commandVisibility, setCommandVisibility] = useState<ActionExecutionVisibility>("public");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"all" | "check" | "damage" | "item">("all");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
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
    setAddDialogOpen(false);
  };

  if (!canEdit || compact || commandLayout) {
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
    const actionCountLabel =
      visibleActions.length === assignedActions.length
        ? `${visibleActions.length} ${visibleActions.length === 1 ? "action" : "actions"}`
        : `${visibleActions.length} of ${assignedActions.length} actions`;

    return (
      <section
        className={`sheet-actions-section sheet-actions-section--command ${compact ? "sheet-actions-section--compact" : ""}`}
      >
        <div className="action-command-toolbar">
          <div className="action-command-toolbar__heading">
            <h4>{compact ? "Pinned Actions" : "Available Actions"}</h4>
            <span className="muted">{actionCountLabel}</span>
          </div>
          <Field label="Search">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find action"
              aria-label="Search assigned actions"
            />
          </Field>
          <div className="action-command-toolbar__control">
            <span className="action-command-toolbar__label">Type</span>
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
          <div className="action-command-toolbar__control action-command-toolbar__mode">
            <span className="action-command-toolbar__label">Roll</span>
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
          <div className="action-command-toolbar__control action-command-toolbar__visibility">
            <span className="action-command-toolbar__label">Audience</span>
            <ActionVisibilityControl value={commandVisibility} onChange={setCommandVisibility} />
          </div>
        </div>

        {canEdit ? (
          <div className="sheet-actions-section__assignment-toolbar">
            <div>
              <strong>Assignments</strong>
              <span className="muted">{assignedActions.length} assigned</span>
            </div>
            <div className="inline-actions">
              <button
                type="button"
                className="button button--secondary"
                aria-haspopup="dialog"
                aria-expanded={addDialogOpen}
                onClick={() => setAddDialogOpen(true)}
              >
                Add Existing
              </button>
              {onOpenCreateAction ? (
                <button
                  type="button"
                  className="button"
                  aria-haspopup="dialog"
                  onClick={onOpenCreateAction}
                >
                  Create Action
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {visibleActions.length === 0 ? (
          <EmptyState
            message={
              assignedActions.length === 0
                ? "No actions assigned to this sheet."
                : "No actions match the current filters."
            }
          />
        ) : (
          <div className="action-command-grid">
            {visibleActions.map((entry) => {
              const allowedModes = actionRollModes(entry.action.roll_mode_kind ?? "none");
              const rollMode = allowedModes.includes(commandRollMode) ? commandRollMode : "normal";
              const isPinned = pinnedActionIds.includes(entry.relationshipId);
              return (
                <article key={entry.relationshipId} className="action-command-card">
                  <button
                    type="button"
                    className="action-command-card__perform"
                    onClick={() => onPerformAction(entry, rollMode, commandVisibility)}
                    aria-label={`Perform ${entry.action.name} using ${rollMode} mode with ${
                      commandVisibility === "gm" ? "GM-only" : "public"
                    } Roll20 output`}
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
                      {commandVisibility === "gm" ? " · GM only" : " · Public"}
                    </small>
                  </button>
                  {Object.keys(entry.action.attributes ?? {}).length > 0 ||
                  onPinnedActionIdsChange ||
                  (canEdit && entry.bridge) ? (
                    <footer className="action-command-card__footer">
                      {Object.keys(entry.action.attributes ?? {}).length > 0 ? (
                        <span className="action-command-card__attribute-count">
                          {Object.keys(entry.action.attributes ?? {}).length} attributes
                        </span>
                      ) : (
                        <span />
                      )}
                      <div className="action-command-card__controls">
                        {onPinnedActionIdsChange ? (
                          <button
                            type="button"
                            className="action-command-card__control"
                            onClick={() =>
                              onPinnedActionIdsChange(
                                isPinned
                                  ? pinnedActionIds.filter((id) => id !== entry.relationshipId)
                                  : [...pinnedActionIds, entry.relationshipId]
                              )
                            }
                          >
                            {isPinned ? "Unpin" : "Pin"}
                          </button>
                        ) : null}
                        {canEdit && entry.bridge ? (
                          <button
                            type="button"
                            className="action-command-card__control action-command-card__control--remove"
                            onClick={() => {
                              if (
                                !confirmDestructiveAction({
                                  action: "Remove",
                                  subject: entry.action.name,
                                  consequence:
                                    "This removes the action assignment from the selected character."
                                })
                              ) {
                                return;
                              }
                              onDelete(entry.relationshipId);
                            }}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </footer>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
        {canEdit && addDialogOpen ? (
          <ModalDialog
            title="Add existing Action"
            description="Choose a reusable Action from the catalog and assign it to this character."
            onClose={() => setAddDialogOpen(false)}
          >
            <div className="stack">
              <CatalogEntityPicker
                catalog="actions"
                label="Action"
                placeholder="Search Action catalog"
                selectedId={selectedActionId}
                options={availableActions.map((action) => ({
                  id: action.id,
                  label: action.name,
                  secondary: action.notes,
                  keywords: [action.id],
                  value: action.id
                }))}
                emptyMessage="Every available Action is already assigned."
                onSelect={setSelectedActionId}
              />
              <div className="inline-actions">
                <button
                  type="button"
                  className="button"
                  onClick={createAssignment}
                  disabled={!selectedActionId}
                >
                  Add Action
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setAddDialogOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </ModalDialog>
        ) : null}
      </section>
    );
  }

  return (
    <section className="sheet-actions-section">
      {canEdit ? (
        <div className="inline-group">
          <CatalogEntityPicker
            catalog="actions"
            label="Global Action"
            placeholder="Search action catalog"
            selectedId={selectedActionId}
            options={availableActions.map((action) => ({
              id: action.id,
              label: action.name,
              secondary: action.notes,
              keywords: [action.id],
              value: action.id
            }))}
            emptyMessage="No unassigned actions."
            onSelect={setSelectedActionId}
          />
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
          const visibility = visibilities[entry.relationshipId] ?? "public";
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
              </div>
              {entry.action.notes ? <div className="muted">{entry.action.notes}</div> : null}
              {entry.sourceItemName ? (
                <div className="muted">
                  Granted by {entry.sourceItemName} ({entry.sourceItemAvailability})
                  {entry.consumeQuantity ? ` · consumes ${entry.consumeQuantity}` : ""}
                </div>
              ) : null}
              <div className="muted">Steps: {entry.action.steps?.length ?? 0}</div>
              {Object.keys(entry.action.attributes ?? {}).length > 0 ? (
                <SheetAttributesSection
                  definitions={attributeDefinitions}
                  bridges={entry.action.attributes ?? {}}
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
              <ActionVisibilityControl
                value={visibility}
                onChange={(nextVisibility) =>
                  setVisibilities((current) => ({
                    ...current,
                    [entry.relationshipId]: nextVisibility
                  }))
                }
              />
              {canEdit && entry.bridge ? (
                <div className="inline-group">
                  <CatalogEntityPicker
                    catalog="actions"
                    label="Assigned Action"
                    placeholder="Search action catalog"
                    selectedId={draftActionId}
                    options={replacementOptions.map((action) => ({
                      id: action.id,
                      label: action.name,
                      secondary: action.notes,
                      keywords: [action.id],
                      value: action.id
                    }))}
                    emptyMessage="No replacement actions."
                    onSelect={(actionId) =>
                      setDraftActionIds((current) => ({
                        ...current,
                        [entry.relationshipId]: actionId
                      }))
                    }
                  />
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
                    onClick={() => {
                      if (
                        !confirmDestructiveAction({
                          action: "Remove",
                          subject: entry.action.name,
                          consequence:
                            "This removes the action assignment from the selected character."
                        })
                      ) {
                        return;
                      }
                      onDelete(entry.relationshipId);
                    }}
                  >
                    Remove
                  </button>
                </div>
              ) : null}
              <div className="inline-actions">
                <button
                  type="button"
                  className="button"
                  onClick={() => onPerformAction(entry, rollMode, visibility)}
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
