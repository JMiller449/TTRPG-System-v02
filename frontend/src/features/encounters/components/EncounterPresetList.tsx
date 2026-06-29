import type { EncounterPreset, Sheet } from "@/domain/models";
import { EmptyState } from "@/shared/ui/EmptyState";

export function EncounterPresetList({
  encounters,
  templates,
  onSpawn,
  onEdit,
  onDelete
}: {
  encounters: EncounterPreset[];
  templates: Record<string, Sheet>;
  onSpawn: (encounterId: string) => void;
  onEdit: (encounter: EncounterPreset) => void;
  onDelete: (encounter: EncounterPreset) => void;
}): JSX.Element {
  return (
    <div className="list">
      {encounters.length === 0 ? <EmptyState message="No saved encounters." /> : null}
      {encounters.map((encounter) => (
        <article key={encounter.id} className="list-item">
          <div>
            <strong>{encounter.name}</strong>
            <div className="muted">
              {encounter.entries
                .map(
                  (entry) =>
                    `${entry.count}x ${templates[entry.templateId]?.name ?? entry.templateId}`
                )
                .join(", ")}
            </div>
          </div>
          <div className="inline-actions">
            <button className="button button--secondary" onClick={() => onEdit(encounter)}>
              Edit
            </button>
            <button className="button button--secondary" onClick={() => onSpawn(encounter.id)}>
              Spawn
            </button>
            <button
              className="button button--secondary"
              aria-label={`Delete encounter preset ${encounter.name}`}
              onClick={() => onDelete(encounter)}
            >
              Delete
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
