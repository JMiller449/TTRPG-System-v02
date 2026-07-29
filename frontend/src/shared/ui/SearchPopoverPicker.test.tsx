import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SearchPopoverPicker } from "@/shared/ui/SearchPopoverPicker";
import {
  buildOrganizedSearchPopoverRows,
  calculateSearchPopoverPosition,
  filterSearchPopoverOptions,
  nextEnabledOptionIndex,
  type SearchPopoverOption
} from "@/shared/ui/searchPopover";

const options: SearchPopoverOption<string>[] = [
  {
    id: "arcane",
    label: "Arcane",
    secondary: "@arc | sheet.stats.arcane",
    keywords: ["magic"],
    value: "arcane"
  },
  {
    id: "blocked",
    label: "Blocked",
    disabledReason: "Unavailable",
    value: "blocked"
  },
  {
    id: "mana",
    label: "Current Mana",
    secondary: "@mana | instance.mana",
    keywords: ["resource"],
    value: "mana"
  }
];

describe("SearchPopoverPicker", () => {
  it("filters labels, compact metadata, and extra keywords", () => {
    expect(filterSearchPopoverOptions(options, "stats.arcane").map((option) => option.id)).toEqual([
      "arcane"
    ]);
    expect(filterSearchPopoverOptions(options, "resource").map((option) => option.id)).toEqual([
      "mana"
    ]);
  });

  it("navigates enabled options, skips disabled rows, and wraps", () => {
    expect(nextEnabledOptionIndex({ options, currentIndex: -1, direction: "next" })).toBe(0);
    expect(nextEnabledOptionIndex({ options, currentIndex: 0, direction: "next" })).toBe(2);
    expect(nextEnabledOptionIndex({ options, currentIndex: 2, direction: "next" })).toBe(0);
    expect(nextEnabledOptionIndex({ options, currentIndex: 0, direction: "previous" })).toBe(2);
    expect(nextEnabledOptionIndex({ options, currentIndex: 0, direction: "last" })).toBe(2);
  });

  it("builds collapsible nested organization and reveals matches through collapsed folders", () => {
    const organization = {
      folders: [
        { id: "weapons", name: "Weapons", parentId: null, position: 0 },
        { id: "swords", name: "Swords", parentId: "weapons", position: 0 }
      ],
      placements: [{ entryId: "longsword", folderId: "swords", position: 0 }]
    };
    const organizedOptions: SearchPopoverOption<string>[] = [
      { id: "longsword", label: "Longsword", value: "longsword" }
    ];

    expect(
      buildOrganizedSearchPopoverRows({
        options: organizedOptions,
        organization,
        query: "",
        collapsedFolderIds: new Set(["weapons", "swords"])
      })
    ).toEqual([{ type: "folder", id: "weapons", name: "Weapons", depth: 0, expanded: false }]);
    expect(
      buildOrganizedSearchPopoverRows({
        options: organizedOptions,
        organization,
        query: "long",
        collapsedFolderIds: new Set(["weapons", "swords"])
      }).map((row) => (row.type === "folder" ? row.name : row.option.label))
    ).toEqual(["Weapons", "Swords", "Longsword"]);
  });

  it("keeps popup geometry within the viewport and opens above cramped anchors", () => {
    expect(
      calculateSearchPopoverPosition({
        anchor: { top: 700, right: 800, bottom: 740, left: 600, width: 240 },
        viewportWidth: 900,
        viewportHeight: 760
      })
    ).toEqual({ top: 376, left: 572, width: 320, maxHeight: 320 });

    expect(
      calculateSearchPopoverPosition({
        anchor: { top: 100, right: 500, bottom: 140, left: 200, width: 300 },
        viewportWidth: 900,
        viewportHeight: 760
      })
    ).toEqual({ top: 144, left: 200, width: 320, maxHeight: 320 });
  });

  it("renders an accessible closed combobox without expanding option content", () => {
    const markup = renderToStaticMarkup(
      <SearchPopoverPicker
        label="Insert Variable"
        placeholder="Search variables"
        options={options}
        onSelect={() => undefined}
      />
    );

    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain("Insert Variable");
    expect(markup).not.toContain('role="option"');
  });
});
