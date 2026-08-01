import { useContext, useMemo } from "react";
import { AppStateContext, StoreContext } from "@/app/state/storeContext";
import { CatalogEntityMultiSelect } from "@/features/catalogs/CatalogEntityMultiSelect";
import { COMMON_FORMULA_TAGS, normalizeFormulaTags } from "@/features/formulas/formulaTags";

export function FormulaTagEditor({
  tags,
  onChange,
  label = "Formula Tags",
  suggestions = COMMON_FORMULA_TAGS
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  label?: string;
  suggestions?: string[];
}): JSX.Element {
  const appStateContext = useContext(AppStateContext);
  const legacyStoreContext = useContext(StoreContext);
  const appState = appStateContext ?? legacyStoreContext?.state ?? null;
  const normalizedTags = normalizeFormulaTags(tags);
  const options = useMemo(() => {
    if (!appState) {
      return normalizeFormulaTags([...suggestions, ...normalizedTags]).map((tagId) => ({
        id: tagId,
        label: tagId
      }));
    }
    const definitions = appState.serverState.tags;
    const orderedIds = [
      ...appState.serverState.tagOrder,
      ...normalizedTags.filter((tagId) => !appState.serverState.tagOrder.includes(tagId))
    ];
    return orderedIds.flatMap((tagId) => {
      const tag = definitions[tagId];
      return tag
        ? [
            {
              id: tag.id,
              label: tag.name,
              secondary: tag.description || tag.id
            }
          ]
        : [{ id: tagId, label: tagId, secondary: "Missing managed tag" }];
    });
  }, [appState, normalizedTags, suggestions]);

  return (
    <div className="formula-tag-catalog">
      <CatalogEntityMultiSelect
        catalog="tags"
        label={label}
        options={options}
        selectedIds={normalizedTags}
        onChange={onChange}
        emptyMessage="No managed tags exist yet. Create them from Rules Data → Tags."
        noResultsMessage="No managed tags match this search."
        selectionAriaLabel={(tagName) => `Select tag ${tagName}`}
        folderSelectionAriaLabel={(folderName) => `Select all tags in ${folderName}`}
        persistentScrollIndicator
        layout="chips"
      />
    </div>
  );
}
