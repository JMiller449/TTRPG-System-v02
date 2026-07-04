import { useMemo } from "react";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import {
  buildAttributeFormulaVariableEntries,
  toAttributeFormulaVariableOptions,
  type AttributeFormulaVariableEntry
} from "@/features/attributes/attributeFormulaVariables";
import { SearchPopoverPicker } from "@/shared/ui/SearchPopoverPicker";

export function AttributeFormulaVariablePicker({
  metadata,
  subjectTypes,
  excludedAttributeId,
  onPick
}: {
  metadata: ActionFormulaAuthoringMetadata | null;
  subjectTypes: Array<"sheet" | "item" | "action">;
  excludedAttributeId?: string;
  onPick: (entry: AttributeFormulaVariableEntry) => void;
}): JSX.Element {
  const options = useMemo(
    () =>
      toAttributeFormulaVariableOptions(
        buildAttributeFormulaVariableEntries(metadata, subjectTypes).filter(
          (entry) => entry.path.join(".") !== `attributes.${excludedAttributeId}`
        )
      ),
    [excludedAttributeId, metadata, subjectTypes]
  );

  return (
    <SearchPopoverPicker
      label="Insert Attribute Variable"
      placeholder="Search available stats and Attributes"
      options={options}
      loading={!metadata}
      emptyMessage="No numeric variables are valid for every selected subject."
      onSelect={onPick}
    />
  );
}
