import type { Role } from "@/domain/models";
import {
  getConsoleSidebarNavGroups,
  type ConsoleView
} from "@/features/console/consoleSidebarData";
import type { PlayerSheetTab } from "@/features/sheets/sheetDisplay";
import { ConsoleSidebarStatus } from "@/features/console/ConsoleSidebarStatus";
import { ConsoleSidebarSearch } from "@/features/console/ConsoleSidebarSearch";
import type { GameClient } from "@/hooks/useGameClient";

interface ConsoleSidebarProps {
  role: Role;
  client: GameClient;
  activeView: ConsoleView;
  activeCharacterSection: PlayerSheetTab;
  onNavigate: (view: ConsoleView) => void;
  onCharacterSectionChange: (section: PlayerSheetTab) => void;
}

export function ConsoleSidebar({
  role,
  client,
  activeView,
  activeCharacterSection,
  onNavigate,
  onCharacterSectionChange
}: ConsoleSidebarProps): JSX.Element {
  const groups = getConsoleSidebarNavGroups(role);

  return (
    <aside
      className="console-sidebar app-nav-panel"
      aria-label={`${role === "gm" ? "GM" : "Player"} pages`}
    >
      <ConsoleSidebarSearch
        role={role}
        onNavigate={onNavigate}
        onCharacterSectionChange={onCharacterSectionChange}
      />
      <div className="console-sidebar__controls">
        <nav className="console-sidebar__nav" aria-label="Console pages">
          {groups.map((group) => (
            <section className="console-sidebar__nav-group" key={group.label}>
              <p className="console-sidebar__nav-group-label">{group.label}</p>
              {group.items.map((item) => {
                const isActive = activeView === item.view;
                const showChildren = isActive && item.children && item.children.length > 0;
                return (
                  <div className="console-sidebar__nav-entry" key={item.view}>
                    <button
                      type="button"
                      className={`console-sidebar__nav-button ${isActive ? "console-sidebar__nav-button--active" : ""}`}
                      aria-current={isActive && !showChildren ? "page" : undefined}
                      aria-expanded={item.children ? isActive : undefined}
                      aria-controls={
                        item.children ? `console-sidebar-${item.view}-sections` : undefined
                      }
                      onClick={() => {
                        if (item.view === "sheet_viewer") {
                          onCharacterSectionChange("dense");
                        }
                        onNavigate(item.view);
                      }}
                    >
                      <span className="console-sidebar__nav-glyph" aria-hidden="true">
                        {item.glyph}
                      </span>
                      <span className="console-sidebar__nav-label">{item.label}</span>
                      {isActive ? (
                        <span className="console-sidebar__nav-active" aria-hidden="true" />
                      ) : null}
                    </button>
                    {showChildren ? (
                      <nav
                        className="console-sidebar__subnav"
                        id={`console-sidebar-${item.view}-sections`}
                        aria-label="Character sections"
                      >
                        {item.children?.map((child) => {
                          const isChildActive = activeCharacterSection === child.section;
                          return (
                            <button
                              key={child.section}
                              type="button"
                              id={`sheet-tab-${child.section}`}
                              className={`console-sidebar__subnav-button ${isChildActive ? "console-sidebar__subnav-button--active" : ""}`}
                              aria-current={isChildActive ? "page" : undefined}
                              onClick={() => {
                                onCharacterSectionChange(child.section);
                                onNavigate("sheet_viewer");
                              }}
                            >
                              <span className="console-sidebar__subnav-marker" aria-hidden="true" />
                              <span>{child.label}</span>
                            </button>
                          );
                        })}
                      </nav>
                    ) : null}
                  </div>
                );
              })}
            </section>
          ))}
        </nav>
      </div>
      <ConsoleSidebarStatus client={client} />
    </aside>
  );
}
