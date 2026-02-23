import { Field } from "@/shared/ui/Field";

export function TemplateSearchBar({
  search,
  spawnCount,
  onSearchChange,
  onSpawnCountChange
}: {
  search: string;
  spawnCount: number;
  onSearchChange: (value: string) => void;
  onSpawnCountChange: (value: number) => void;
}): JSX.Element {
  return (
    <>
      <Field label="Search Templates">
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by name or tag"
        />
      </Field>

      <Field label="Spawn Count">
        <input
          type="number"
          min={1}
          value={spawnCount}
          onChange={(event) => onSpawnCountChange(Number(event.target.value) || 1)}
        />
      </Field>
    </>
  );
}
