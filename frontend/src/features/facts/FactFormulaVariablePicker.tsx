import { useMemo } from "react";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import {
  buildFactFormulaVariableEntries,
  toFactFormulaVariableOptions,
  type FactFormulaVariableEntry
} from "@/features/facts/factFormulaVariables";
import { SearchPopoverPicker } from "@/shared/ui/SearchPopoverPicker";

export function FactFormulaVariablePicker({
  metadata,
  subjectTypes,
  excludedFactId,
  onPick
}: {
  metadata: ActionFormulaAuthoringMetadata | null;
  subjectTypes: Array<"sheet" | "item" | "action">;
  excludedFactId?: string;
  onPick: (entry: FactFormulaVariableEntry) => void;
}): JSX.Element {
  const options = useMemo(
    () =>
      toFactFormulaVariableOptions(
        buildFactFormulaVariableEntries(metadata, subjectTypes).filter(
          (entry) => entry.path.join(".") !== `facts.${excludedFactId}`
        )
      ),
    [excludedFactId, metadata, subjectTypes]
  );

  return (
    <SearchPopoverPicker
      label="Insert Fact Variable"
      placeholder="Search available stats and Facts"
      options={options}
      loading={!metadata}
      emptyMessage="No numeric variables are valid for every selected subject."
      onSelect={onPick}
    />
  );
}
