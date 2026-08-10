import type { StandaloneEffectDefinition } from "@/domain/models";
import { CatalogEntityMultiSelect } from "@/features/catalogs/CatalogEntityMultiSelect";

export function EffectReferenceEditor({
  effects,
  selectedIds,
  onChange,
  label = "Effects"
}: {
  effects: Record<string, StandaloneEffectDefinition>;
  selectedIds: string[];
  onChange: (effectIds: string[]) => void;
  label?: string;
}): JSX.Element {
  return (
    <div className="stack">
      <CatalogEntityMultiSelect
        catalog="effects"
        label={label}
        options={Object.values(effects).map((effect) => ({
          id: effect.id,
          label: effect.name,
          secondary: effect.description || effect.id
        }))}
        selectedIds={selectedIds}
        onChange={onChange}
        emptyMessage="No effects exist yet. Create one in Effect Authoring first."
        noResultsMessage="No effects match this search."
        selectionAriaLabel={(effectName) => `Select effect ${effectName}`}
        folderSelectionAriaLabel={(folderName) => `Select all effects in ${folderName}`}
      />
      <p className="muted">
        Effects are reusable definitions. Edits update item and action consumers plus future
        condition applications; active conditions keep their applied snapshot.
      </p>
    </div>
  );
}
