import { useContext, useMemo } from "react";
import { selectSheetInstanceView } from "@/app/state/selectors";
import { AppStateContext, StoreContext } from "@/app/state/storeContext";
import type { ItemPlayerCatalogAccess, SheetInstanceView } from "@/domain/models";
import { CatalogEntityMultiSelect } from "@/features/catalogs/CatalogEntityMultiSelect";

const ACCESS_OPTIONS: ReadonlyArray<{
  mode: ItemPlayerCatalogAccess["mode"];
  label: string;
  description: string;
}> = [
  {
    mode: "none",
    label: "No players",
    description: "Only the DM can add this item."
  },
  {
    mode: "all",
    label: "All players",
    description: "Every claimed player sheet, including future sheets, can find and add it."
  },
  {
    mode: "selected",
    label: "Selected players",
    description: "Only the chosen spawned player sheets can find and add it."
  }
];

export function ItemPlayerAvailabilityEditor({
  value,
  onChange
}: {
  value: ItemPlayerCatalogAccess;
  onChange: (value: ItemPlayerCatalogAccess) => void;
}): JSX.Element {
  const appState = useContext(AppStateContext);
  const legacyStore = useContext(StoreContext);
  const state = appState ?? legacyStore?.state;
  const playerOptions = useMemo(
    () => {
      if (!state) {
        return [];
      }
      return state.serverState.persistentSheetOrder
        .map((instanceId) => selectSheetInstanceView(state, instanceId))
        .filter(
          (sheet): sheet is SheetInstanceView => sheet !== null && sheet.kind === "player"
        )
        .map((sheet) => ({
          id: sheet.id,
          label: sheet.name,
          secondary: sheet.id,
          keywords: [sheet.parentSheet?.id ?? ""]
        }));
    },
    [state]
  );
  const summary =
    value.mode === "none"
      ? "No players"
      : value.mode === "all"
        ? "All players"
        : `${value.instanceIds.length} selected`;

  return (
    <details className="authoring-disclosure item-player-availability">
      <summary>
        <span>
          <strong>Player inventory availability</strong>
          <small>{summary}</small>
        </span>
      </summary>
      <div className="authoring-disclosure__body stack">
        <p className="muted">
          Choose which claimed character sheets may find and add this item. Folders provide
          bulk selection only; moving a sheet later does not change access.
        </p>
        <fieldset className="item-player-availability__modes">
          <legend>Availability</legend>
          {ACCESS_OPTIONS.map((option) => (
            <label key={option.mode}>
              <input
                type="radio"
                name="item-player-catalog-access"
                value={option.mode}
                checked={value.mode === option.mode}
                onChange={() =>
                  onChange({
                    mode: option.mode,
                    instanceIds: option.mode === "selected" ? value.instanceIds : []
                  })
                }
              />
              <span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
            </label>
          ))}
        </fieldset>
        {value.mode === "selected" ? (
          <CatalogEntityMultiSelect
            catalog="sheet_instances"
            label="Allowed player sheets"
            options={playerOptions}
            selectedIds={value.instanceIds}
            onChange={(instanceIds) =>
              onChange({
                mode: "selected",
                instanceIds
              })
            }
          />
        ) : null}
      </div>
    </details>
  );
}
