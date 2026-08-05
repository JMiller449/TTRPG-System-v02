import { useEffect, useMemo, useState } from "react";
import type { ProficiencyBridge, ProficiencyDefinition } from "@/domain/models";
import {
  formatSheetProficiencyPercentage,
  parseSheetProficiencyGrowthRate,
  parseSheetProficiencyUseCount,
  selectAvailableSheetProficiencies,
  selectSheetProficiencyEntries,
  toSheetProficiencyBridgePayload
} from "@/features/sheets/sheetProficiencies";
import type { SheetProficiencyBridgePayload } from "@/infrastructure/ws/requestBuilders";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Field } from "@/shared/ui/Field";
import { ModalDialog } from "@/shared/ui/ModalDialog";
import { confirmDestructiveAction } from "@/shared/ui/confirmDestructiveAction";
import { CatalogEntityPicker } from "@/features/catalogs/CatalogEntityPicker";

interface ProficiencyBridgeDraft {
  proficiencyId: string;
  useCount: string;
  growthRate: string;
}

function toDraft(bridge: ProficiencyBridge): ProficiencyBridgeDraft {
  return {
    proficiencyId: bridge.prof_id,
    useCount: String(bridge.use_count),
    growthRate: String(bridge.growth_rate)
  };
}

export function SheetProficienciesSection({
  proficiencyDefinitions,
  proficiencyOrder,
  sheetProficiencies,
  canEdit,
  onCreate,
  onOpenCreateProficiency,
  onUpdate,
  onDelete
}: {
  proficiencyDefinitions: Record<string, ProficiencyDefinition>;
  proficiencyOrder: string[];
  sheetProficiencies: ProficiencyBridge[];
  canEdit: boolean;
  onCreate: (bridge: SheetProficiencyBridgePayload) => void;
  onOpenCreateProficiency?: () => void;
  onUpdate: (relationshipId: string, bridge: SheetProficiencyBridgePayload) => void;
  onDelete: (relationshipId: string) => void;
}): JSX.Element {
  const entries = useMemo(
    () => selectSheetProficiencyEntries(sheetProficiencies, proficiencyDefinitions),
    [proficiencyDefinitions, sheetProficiencies]
  );
  const availableProficiencies = useMemo(
    () =>
      selectAvailableSheetProficiencies(
        proficiencyDefinitions,
        proficiencyOrder,
        sheetProficiencies
      ),
    [proficiencyDefinitions, proficiencyOrder, sheetProficiencies]
  );
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingRelationshipId, setEditingRelationshipId] = useState<string | null>(null);
  const [selectedProficiencyId, setSelectedProficiencyId] = useState("");
  const [newUseCount, setNewUseCount] = useState("0");
  const [newGrowthRate, setNewGrowthRate] = useState("1");
  const [drafts, setDrafts] = useState<Record<string, ProficiencyBridgeDraft>>({});

  const availableProficiencyIds = availableProficiencies
    .map((proficiency) => proficiency.id)
    .join("|");
  const editingEntry = editingRelationshipId
    ? entries.find(({ bridge }) => bridge.relationship_id === editingRelationshipId)
    : undefined;

  useEffect(() => {
    setSelectedProficiencyId((current) =>
      availableProficiencies.some((proficiency) => proficiency.id === current)
        ? current
        : (availableProficiencies[0]?.id ?? "")
    );
  }, [availableProficiencyIds, availableProficiencies]);

  useEffect(() => {
    if (editingRelationshipId && !editingEntry) {
      setEditingRelationshipId(null);
    }
  }, [editingEntry, editingRelationshipId]);

  const assignedProficiencyIds = new Set(sheetProficiencies.map((bridge) => bridge.prof_id));

  const closeAddDialog = (): void => {
    setAddDialogOpen(false);
    setNewUseCount("0");
    setNewGrowthRate("1");
  };

  const submitNewBridge = (): void => {
    const useCount = parseSheetProficiencyUseCount(newUseCount);
    const growthRate = parseSheetProficiencyGrowthRate(newGrowthRate);
    if (!selectedProficiencyId || useCount === null || growthRate === null) {
      return;
    }

    onCreate(
      toSheetProficiencyBridgePayload({
        relationshipId: selectedProficiencyId,
        proficiencyId: selectedProficiencyId,
        useCount,
        growthRate
      })
    );
    closeAddDialog();
  };

  return (
    <section
      className="character-sheet__section sheet-proficiency-section"
      aria-label="Proficiency assignments"
    >
      {canEdit ? (
        <div className="sheet-proficiency-toolbar">
          <span className="muted">{entries.length} assigned</span>
          <div className="inline-actions">
            <button
              type="button"
              className="button button--secondary"
              disabled={availableProficiencies.length === 0}
              onClick={() => setAddDialogOpen(true)}
            >
              Add Existing
            </button>
            {onOpenCreateProficiency ? (
              <button type="button" className="button" onClick={onOpenCreateProficiency}>
                Create Proficiency
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="sheet-proficiency-grid">
        {entries.length === 0 ? <EmptyState message="No proficiencies assigned yet." /> : null}
        {entries.map(({ bridge, proficiency, label }) => {
          const content = (
            <>
              <span className="sheet-proficiency-summary__heading">
                <strong>{label}</strong>
                {proficiency?.category ? (
                  <span className="badge">
                    {proficiency.category === "weapon_family" ? "Weapon" : "Custom"}
                  </span>
                ) : null}
              </span>
              <span className="sheet-proficiency-summary__percentage">
                {formatSheetProficiencyPercentage(bridge)}%
              </span>
              <span className="sheet-proficiency-summary__metrics muted">
                <span>{bridge.use_count} uses</span>
                <span>Growth {bridge.growth_rate}</span>
              </span>
              {proficiency?.description ? (
                <span className="sheet-proficiency-summary__description muted">
                  {proficiency.description}
                </span>
              ) : null}
              {!proficiency ? (
                <span className="error-text sheet-proficiency-summary__description">
                  Missing global proficiency.
                </span>
              ) : null}
            </>
          );
          const className = "card sheet-proficiency-summary";

          return canEdit ? (
            <button
              key={bridge.relationship_id}
              type="button"
              className={className}
              aria-label={`Edit ${label}. Proficiency ${formatSheetProficiencyPercentage(bridge)} percent, ${bridge.use_count} uses, growth ${bridge.growth_rate}.`}
              onClick={() => {
                setDrafts((current) => ({
                  ...current,
                  [bridge.relationship_id]: toDraft(bridge)
                }));
                setEditingRelationshipId(bridge.relationship_id);
              }}
            >
              {content}
            </button>
          ) : (
            <article key={bridge.relationship_id} className={className}>
              {content}
            </article>
          );
        })}
      </div>

      {canEdit && addDialogOpen ? (
        <ModalDialog
          title="Add Existing Proficiency"
          description="Assign a reusable Proficiency and set this character's starting progression."
          onClose={closeAddDialog}
        >
          <div className="stack sheet-proficiency-dialog">
            <CatalogEntityPicker
              catalog="proficiencies"
              label="Proficiency"
              placeholder="Search proficiency catalog"
              selectedId={selectedProficiencyId}
              options={availableProficiencies.map((proficiency) => ({
                id: proficiency.id,
                label: proficiency.name,
                secondary: proficiency.description,
                keywords: [proficiency.id],
                value: proficiency.id
              }))}
              emptyMessage="No proficiencies available."
              onSelect={setSelectedProficiencyId}
            />
            <div className="inline-group">
              <Field label="Uses">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={newUseCount}
                  onChange={(event) => setNewUseCount(event.target.value)}
                />
              </Field>
              <Field label="Growth">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newGrowthRate}
                  onChange={(event) => setNewGrowthRate(event.target.value)}
                />
              </Field>
            </div>
            <div className="inline-actions">
              <button
                type="button"
                className="button"
                onClick={submitNewBridge}
                disabled={
                  !selectedProficiencyId ||
                  parseSheetProficiencyUseCount(newUseCount) === null ||
                  parseSheetProficiencyGrowthRate(newGrowthRate) === null
                }
              >
                Add Proficiency
              </button>
              <button type="button" className="button button--secondary" onClick={closeAddDialog}>
                Cancel
              </button>
            </div>
          </div>
        </ModalDialog>
      ) : null}

      {canEdit && editingEntry ? (
        <ProficiencyAssignmentDialog
          bridge={editingEntry.bridge}
          label={editingEntry.label}
          proficiency={editingEntry.proficiency}
          proficiencyDefinitions={proficiencyDefinitions}
          proficiencyOrder={proficiencyOrder}
          assignedProficiencyIds={assignedProficiencyIds}
          draft={drafts[editingEntry.bridge.relationship_id] ?? toDraft(editingEntry.bridge)}
          onDraftChange={(draft) =>
            setDrafts((current) => ({
              ...current,
              [editingEntry.bridge.relationship_id]: draft
            }))
          }
          onUpdate={onUpdate}
          onDelete={onDelete}
          onClose={() => setEditingRelationshipId(null)}
        />
      ) : null}
    </section>
  );
}

function ProficiencyAssignmentDialog({
  bridge,
  label,
  proficiency,
  proficiencyDefinitions,
  proficiencyOrder,
  assignedProficiencyIds,
  draft,
  onDraftChange,
  onUpdate,
  onDelete,
  onClose
}: {
  bridge: ProficiencyBridge;
  label: string;
  proficiency: ProficiencyDefinition | null;
  proficiencyDefinitions: Record<string, ProficiencyDefinition>;
  proficiencyOrder: string[];
  assignedProficiencyIds: Set<string>;
  draft: ProficiencyBridgeDraft;
  onDraftChange: (draft: ProficiencyBridgeDraft) => void;
  onUpdate: (relationshipId: string, bridge: SheetProficiencyBridgePayload) => void;
  onDelete: (relationshipId: string) => void;
  onClose: () => void;
}): JSX.Element {
  const draftUseCount = parseSheetProficiencyUseCount(draft.useCount);
  const draftGrowthRate = parseSheetProficiencyGrowthRate(draft.growthRate);
  const canSaveDraft =
    Boolean(proficiencyDefinitions[draft.proficiencyId]) &&
    draftUseCount !== null &&
    draftGrowthRate !== null;
  const changed =
    draft.proficiencyId !== bridge.prof_id ||
    draftUseCount !== bridge.use_count ||
    draftGrowthRate !== bridge.growth_rate;
  const options = proficiencyOrder
    .map((proficiencyId) => proficiencyDefinitions[proficiencyId])
    .filter(
      (entry): entry is ProficiencyDefinition =>
        Boolean(entry) && (!assignedProficiencyIds.has(entry.id) || entry.id === bridge.prof_id)
    );

  return (
    <ModalDialog
      title={`Edit ${label}`}
      description="Update this character's Proficiency assignment and progression."
      onClose={onClose}
    >
      <div className="stack sheet-proficiency-dialog">
        <div className="sheet-proficiency-dialog__summary">
          <strong>{formatSheetProficiencyPercentage(bridge)}% proficiency</strong>
          {proficiency?.description ? (
            <span className="muted">{proficiency.description}</span>
          ) : null}
        </div>
        <CatalogEntityPicker
          catalog="proficiencies"
          label="Proficiency"
          placeholder="Search proficiency catalog"
          selectedId={draft.proficiencyId}
          options={[
            ...(proficiencyDefinitions[draft.proficiencyId]
              ? []
              : [
                  {
                    id: draft.proficiencyId,
                    label: `Missing proficiency: ${draft.proficiencyId}`,
                    disabledReason: "Missing definition",
                    value: draft.proficiencyId
                  }
                ]),
            ...options.map((entry) => ({
              id: entry.id,
              label: entry.name,
              secondary: entry.description,
              keywords: [entry.id],
              value: entry.id
            }))
          ]}
          emptyMessage="No replacement proficiencies."
          onSelect={(proficiencyId) => onDraftChange({ ...draft, proficiencyId })}
        />
        <div className="inline-group">
          <Field label="Uses">
            <input
              type="number"
              min="0"
              step="1"
              value={draft.useCount}
              onChange={(event) => onDraftChange({ ...draft, useCount: event.target.value })}
            />
          </Field>
          <Field label="Growth">
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.growthRate}
              onChange={(event) => onDraftChange({ ...draft, growthRate: event.target.value })}
            />
          </Field>
        </div>
        <div className="inline-actions sheet-proficiency-dialog__actions">
          <button
            type="button"
            className="button"
            onClick={() => {
              if (!canSaveDraft || draftUseCount === null || draftGrowthRate === null) {
                return;
              }
              onUpdate(
                bridge.relationship_id,
                toSheetProficiencyBridgePayload({
                  relationshipId: bridge.relationship_id,
                  proficiencyId: draft.proficiencyId,
                  useCount: draftUseCount,
                  growthRate: draftGrowthRate
                })
              );
            }}
            disabled={!canSaveDraft || !changed}
          >
            Save Assignment
          </button>
          <button
            type="button"
            className="button button--danger"
            onClick={() => {
              if (
                !confirmDestructiveAction({
                  action: "Remove",
                  subject: label,
                  consequence:
                    "This removes the proficiency assignment and its current use progression from the selected character."
                })
              ) {
                return;
              }
              onDelete(bridge.relationship_id);
              onClose();
            }}
          >
            Remove Assignment
          </button>
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}
