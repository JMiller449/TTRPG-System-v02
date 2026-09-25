import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Role } from "@/domain/models";
import {
  getConsoleSidebarNavGroups,
  type ConsoleView
} from "@/features/console/consoleSidebarData";
import type { PlayerSheetTab } from "@/features/sheets/sheetDisplay";
import {
  filterSearchPopoverOptions,
  nextEnabledOptionIndex,
  type SearchPopoverOption
} from "@/shared/ui/searchPopover";

interface SidebarSearchTarget {
  view: ConsoleView;
  characterSection?: PlayerSheetTab;
}

function navigationOptions(role: Role): SearchPopoverOption<SidebarSearchTarget>[] {
  return getConsoleSidebarNavGroups(role).flatMap((group) =>
    group.items.flatMap((item) => {
      const parent: SearchPopoverOption<SidebarSearchTarget> = {
        id: `view:${item.view}`,
        label: item.label,
        secondary: group.label,
        keywords: [item.glyph, item.view],
        value: {
          view: item.view,
          characterSection: item.view === "sheet_viewer" ? "dense" : undefined
        }
      };
      const children = (item.children ?? []).map((child) => ({
        id: `character:${child.section}`,
        label: child.label,
        secondary: item.label,
        keywords: [child.section, group.label],
        value: { view: item.view, characterSection: child.section }
      }));
      return [parent, ...children];
    })
  );
}

export function ConsoleSidebarSearch({
  role,
  onNavigate,
  onCharacterSectionChange
}: {
  role: Role;
  onNavigate: (view: ConsoleView) => void;
  onCharacterSectionChange: (section: PlayerSheetTab) => void;
}): JSX.Element {
  const listboxId = `console-nav-search-${useId().replace(/:/g, "")}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const options = useMemo(() => navigationOptions(role), [role]);
  const results = useMemo(() => filterSearchPopoverOptions(options, query), [options, query]);

  useEffect(() => {
    setActiveIndex(results.length > 0 ? 0 : -1);
  }, [results]);

  const close = (clear = false): void => {
    setOpen(false);
    if (clear) {
      setQuery("");
    }
  };

  const selectResult = (option: SearchPopoverOption<SidebarSearchTarget> | undefined): void => {
    if (!option) {
      return;
    }
    if (option.value.characterSection) {
      onCharacterSectionChange(option.value.characterSection);
    }
    onNavigate(option.value.view);
    close(true);
  };

  const moveActive = (direction: "next" | "previous"): void => {
    setOpen(true);
    setActiveIndex((currentIndex) =>
      nextEnabledOptionIndex({ options: results, currentIndex, direction })
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive("next");
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive("previous");
    } else if (event.key === "Enter") {
      event.preventDefault();
      selectResult(results[activeIndex] ?? results[0]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    }
  };

  return (
    <div
      className="console-sidebar-search"
      ref={rootRef}
      onBlur={() => {
        requestAnimationFrame(() => {
          if (!rootRef.current?.contains(document.activeElement)) {
            close();
          }
        });
      }}
    >
      <label htmlFor={`${listboxId}-input`} className="console-sidebar-search__label">
        Search navigation
      </label>
      <input
        id={`${listboxId}-input`}
        type="search"
        role="combobox"
        aria-label="Search navigation"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={
          open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
        }
        value={query}
        placeholder="Search navigation"
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {open ? (
        <div className="console-sidebar-search__results" id={listboxId} role="listbox">
          {results.length === 0 ? (
            <p className="console-sidebar-search__empty">No matching destinations.</p>
          ) : (
            results.map((option, index) => {
              const active = index === activeIndex;
              return (
                <button
                  key={option.id}
                  type="button"
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={active}
                  className={`console-sidebar-search__result ${active ? "console-sidebar-search__result--active" : ""}`}
                  onPointerEnter={() => setActiveIndex(index)}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => selectResult(option)}
                >
                  <span>{option.secondary}</span>
                  <strong>{option.label}</strong>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
