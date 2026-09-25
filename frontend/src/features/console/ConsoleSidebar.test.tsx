import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { initialState } from "@/app/state/initialState";
import { StoreContext } from "@/app/state/storeContext";
import { ConsoleSidebar } from "@/features/console/ConsoleSidebar";
import {
  CONSOLE_SIDEBAR_NAV_GROUPS,
  CONSOLE_SIDEBAR_NAV_ITEMS,
  getConsoleSidebarNavGroups
} from "@/features/console/consoleSidebarData";
import type { GameClient } from "@/hooks/useGameClient";

const client = { endSession: vi.fn() } as unknown as GameClient;

function renderSidebar(props: Parameters<typeof ConsoleSidebar>[0]): string {
  return renderToStaticMarkup(
    createElement(
      StoreContext.Provider,
      { value: { state: initialState, dispatch: () => undefined } },
      createElement(ConsoleSidebar, props)
    )
  );
}

describe("ConsoleSidebar", () => {
  it("defines one unique option for every GM page", () => {
    const views = CONSOLE_SIDEBAR_NAV_ITEMS.map((item) => item.view);

    expect(new Set(views).size).toBe(views.length);
    expect(views).toEqual([
      "sheet_viewer",
      "action_history",
      "template_library",
      "create_template",
      "action_authoring",
      "item_maker",
      "item_template_builder",
      "attribute_authoring",
      "formula_authoring",
      "proficiency_authoring",
      "tag_authoring",
      "condition_authoring",
      "effect_authoring",
      "encounter_presets",
      "xp_tracker",
      "state_backup",
      "extension"
    ]);
  });

  it("uses Characters as the shared primary session workspace", () => {
    expect(CONSOLE_SIDEBAR_NAV_GROUPS[0]?.items[0]).toMatchObject({
      view: "sheet_viewer",
      label: "Characters",
      glyph: "CH"
    });
  });

  it("groups GM pages into task-oriented workspaces", () => {
    expect(getConsoleSidebarNavGroups("gm").map((group) => group.label)).toEqual([
      "Session",
      "Templates",
      "Content",
      "Rules Data",
      "Status Effects",
      "Encounters",
      "Admin"
    ]);
  });

  it("shows players only shared role-appropriate destinations", () => {
    const playerGroups = getConsoleSidebarNavGroups("player");

    expect(playerGroups.map((group) => group.label)).toEqual(["Session", "Admin"]);
    expect(playerGroups.flatMap((group) => group.items.map((item) => item.view))).toEqual([
      "sheet_viewer",
      "extension"
    ]);
    expect(playerGroups[0]?.items[0]?.children?.map((item) => item.section)).toEqual([
      "dense",
      "stats",
      "statuses",
      "actions",
      "inventory",
      "resistances",
      "attributes",
      "proficiencies",
      "kills",
      "backstory",
      "notes"
    ]);

    const markup = renderSidebar({
      role: "player",
      client,
      activeView: "sheet_viewer",
      activeCharacterSection: "dense",
      onNavigate: vi.fn(),
      onCharacterSectionChange: vi.fn()
    });
    expect(markup).toContain("Characters");
    expect(markup).toContain("Dense");
    expect(markup).toContain("Stats");
    expect(markup).toContain("Extension");
    expect(markup).not.toContain("Action History");
    expect(markup).not.toContain("Management");
    expect(markup).not.toContain("Backup &amp; Undo");
  });

  it("shows GM-only character sections and marks the selected child", () => {
    const markup = renderSidebar({
      role: "gm",
      client,
      activeView: "sheet_viewer",
      activeCharacterSection: "management",
      onNavigate: vi.fn(),
      onCharacterSectionChange: vi.fn()
    });

    expect(markup).toContain("Action History");
    expect(markup).toContain("Management");
    expect(markup).toContain("Organize Sheets");
    expect(markup).toContain('id="sheet-tab-management"');
    expect(markup).toContain('id="sheet-tab-organize_sheets"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).not.toContain("Active sheet");
    expect(markup).not.toContain("Select preset");
    expect(markup).not.toContain(">Spawn<");
  });

  it("collapses character sections outside the Characters workspace", () => {
    const markup = renderSidebar({
      role: "gm",
      client,
      activeView: "action_history",
      activeCharacterSection: "dense",
      onNavigate: vi.fn(),
      onCharacterSectionChange: vi.fn()
    });

    expect(markup).not.toContain('aria-label="Character sections"');
    expect(markup).not.toContain('id="sheet-tab-dense"');
  });
});
