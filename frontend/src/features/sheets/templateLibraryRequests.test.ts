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
        'Delete template "Mage" (mage_template)? This cannot be undone. Spawned instances must be despawned first. Encounter entries using this template will be removed, and presets left empty will be deleted.'
    });
  });
});
