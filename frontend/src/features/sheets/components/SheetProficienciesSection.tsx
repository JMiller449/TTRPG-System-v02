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
  onUpdate,
  onDelete
}: {
  proficiencyDefinitions: Record<string, ProficiencyDefinition>;
  proficiencyOrder: string[];
  sheetProficiencies: ProficiencyBridge[];
  canEdit: boolean;
  onCreate: (bridge: SheetProficiencyBridgePayload) => void;
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
  const [selectedProficiencyId, setSelectedProficiencyId] = useState("");
  const [newUseCount, setNewUseCount] = useState("0");
  const [newGrowthRate, setNewGrowthRate] = useState("1");
  const [drafts, setDrafts] = useState<Record<string, ProficiencyBridgeDraft>>({});

  const availableProficiencyIds = availableProficiencies
    .map((proficiency) => proficiency.id)
    .join("|");

  useEffect(() => {
    setSelectedProficiencyId((current) =>
      availableProficiencies.some((proficiency) => proficiency.id === current)
        ? current
        : (availableProficiencies[0]?.id ?? "")
    );
  }, [availableProficiencyIds, availableProficiencies]);

  const assignedProficiencyIds = new Set(sheetProficiencies.map((bridge) => bridge.prof_id));

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
    setNewUseCount("0");
    setNewGrowthRate("1");
  };

  return (
    <section className="character-sheet__section" aria-label="Proficiency assignments">
      {canEdit ? (
        <div className="sheet-proficiency-add-row">
          <Field label="Proficiency">
            <select
              value={selectedProficiencyId}
              onChange={(event) => setSelectedProficiencyId(event.target.value)}
            >
              {availableProficiencies.length === 0 ? (
                <option value="">No proficiencies available</option>
              ) : null}
              {availableProficiencies.map((proficiency) => (
                <option key={proficiency.id} value={proficiency.id}>
                  {proficiency.name}
                </option>
              ))}
            </select>
          </Field>
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
            Add
          </button>
        </div>
      ) : null}
      <div className="list">
        {entries.length === 0 ? <EmptyState message="No proficiencies assigned yet." /> : null}
        {entries.map(({ bridge, proficiency, label }) => {
          const draft = drafts[bridge.relationship_id] ?? toDraft(bridge);
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
                Boolean(entry) &&
                (!assignedProficiencyIds.has(entry.id) || entry.id === bridge.prof_id)
            );

          return (
            <article key={bridge.relationship_id} className="list-item list-item--block">
              <div className="sheet-proficiency-card__top">
                <div>
                  <strong>{label}</strong>
                  <div className="muted">{bridge.prof_id}</div>
                  {!proficiency ? (
                    <div className="error-text">Missing global proficiency.</div>
                  ) : null}
                </div>
                <div className="sheet-proficiency-card__metrics">
                  <span>Proficiency {formatSheetProficiencyPercentage(bridge)}%</span>
                  <span>Uses {bridge.use_count}</span>
                  <span>Growth {bridge.growth_rate}</span>
                </div>
              </div>
              {proficiency?.description ? <p className="muted">{proficiency.description}</p> : null}
              {canEdit ? (
                <div className="sheet-proficiency-editor">
                  <Field label="Proficiency">
                    <select
                      value={draft.proficiencyId}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [bridge.relationship_id]: {
                            ...draft,
                            proficiencyId: event.target.value
                          }
                        }))
                      }
                    >
                      {proficiencyDefinitions[draft.proficiencyId] ? null : (
                        <option value={draft.proficiencyId} disabled>
                          {draft.proficiencyId}
                        </option>
                      )}
                      {options.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Uses">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={draft.useCount}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [bridge.relationship_id]: {
                            ...draft,
                            useCount: event.target.value
                          }
                        }))
                      }
                    />
                  </Field>
                  <Field label="Growth">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.growthRate}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [bridge.relationship_id]: {
                            ...draft,
                            growthRate: event.target.value
                          }
                        }))
                      }
                    />
                  </Field>
                  <div className="inline-actions">
                    <button
                      type="button"
                      className="button button--secondary"
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
                      Save
                    </button>
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={() => onDelete(bridge.relationship_id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
