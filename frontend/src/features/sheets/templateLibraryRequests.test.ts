import { describe, expect, it } from "vitest";
import { buildDeleteTemplateSubmission } from "@/features/sheets/templateLibraryRequests";

describe("templateLibraryRequests", () => {
  it("builds a confirmed typed template deletion submission", () => {
    expect(buildDeleteTemplateSubmission({ id: "mage_template", name: "Mage" })).toEqual({
      request: {
        type: "delete_sheet",
        sheet_id: "mage_template"
      },
      label: "Delete template: Mage",
      confirmation:
        'Delete template "Mage" (mage_template)? This cannot be undone. Templates referenced by instances or encounter presets must be unlinked first.'
    });
  });
});
