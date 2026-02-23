import type { EncounterPreset, SheetTemplate } from "@/domain/models";
import { EmptyState } from "@/shared/ui/EmptyState";

export function EncounterPresetList({
  encounters,
  templates,
  onSpawn
}: {
  encounters: EncounterPreset[];
  templates: Record<string, SheetTemplate>;
  onSpawn: (encounterId: string) => void;
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
                .map((entry) => `${entry.count}x ${templates[entry.templateId]?.name ?? entry.templateId}`)
                .join(", ")}
            </div>
          </div>
          <button className="button button--secondary" onClick={() => onSpawn(encounter.id)}>
            Spawn
          </button>
        </article>
      ))}
    </div>
  );
}
