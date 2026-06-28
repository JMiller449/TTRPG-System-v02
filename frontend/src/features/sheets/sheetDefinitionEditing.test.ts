import { describe, expect, it } from "vitest";
import {
  parseResistancePercentDraft,
  toResistancePercentDraft,
  toSheetRelativeFormulaAlias
} from "@/features/sheets/sheetDefinitionEditing";
import type { VariablePickerEntry } from "@/features/variables/variablePicker";

describe("sheetDefinitionEditing", () => {
  it("converts resistance fractions to percent drafts and back", () => {
    const draft = toResistancePercentDraft({ resistance: 0.1, physical: 0.25, fire: 1 });
    expect(draft.resistance).toBe("10");
    expect(draft.physical).toBe("25");
    expect(draft.fire).toBe("100");
    expect(parseResistancePercentDraft(draft)).toMatchObject({
      resistance: 0.1,
      physical: 0.25,
      fire: 1,
      ice: 0
    });
  });

  it("rejects resistance percentages outside zero through one hundred", () => {
    const draft = toResistancePercentDraft(undefined);
    draft.fire = "100.1";
    expect(parseResistancePercentDraft(draft)).toBeNull();
    draft.fire = "not-a-number";
    expect(parseResistancePercentDraft(draft)).toBeNull();
  });

  it("converts metadata aliases to relative sheet paths only", () => {
    const entry: VariablePickerEntry = {
      key: "sheet.stats.constitution",
      label: "Constitution",
      root: "sheet",
      path: ["stats", "constitution"],
      valueType: "number",
      description: "",
      shortcuts: [],
      formulaReferenceAllowed: true,
      actionMutationAllowed: true,
      token: "@constitution",
      alias: { name: "constitution", path: ["sheet", "stats", "constitution"] }
    };
    expect(toSheetRelativeFormulaAlias(entry)).toEqual({
      name: "constitution",
      path: ["stats", "constitution"]
    });
    expect(toSheetRelativeFormulaAlias({ ...entry, root: "instance" })).toBeNull();
  });
});
