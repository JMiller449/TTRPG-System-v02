import { useMemo } from "react";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import { SearchPopoverPicker } from "@/shared/ui/SearchPopoverPicker";
import {
  buildVariablePickerEntries,
  toVariableSearchOptions,
  type VariablePickerEntry,
  type VariablePickerMode
} from "@/features/variables/variablePicker";

export function VariableSearchPicker({
  metadata,
  mode,
  root,
  label,
  onPick
}: {
  metadata: ActionFormulaAuthoringMetadata | null;
  mode: VariablePickerMode;
  root?: VariablePickerEntry["root"];
  label?: string;
  onPick: (entry: VariablePickerEntry) => void;
}): JSX.Element {
  const options = useMemo(
    () =>
      toVariableSearchOptions(
        buildVariablePickerEntries(metadata, mode).filter((entry) => !root || entry.root === root)
      ),
    [metadata, mode, root]
  );
  return (
    <SearchPopoverPicker
      label={label ?? (mode === "formula" ? "Insert Variable" : "Select Variable")}
      placeholder="Search variables, shortcuts, or paths"
      options={options}
      loading={!metadata}
      emptyMessage="No matching variables."
      onSelect={onPick}
    />
  );
}
