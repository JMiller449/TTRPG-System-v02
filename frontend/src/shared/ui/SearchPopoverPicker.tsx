import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent
} from "react";
import { createPortal } from "react-dom";
import {
  buildOrganizedSearchPopoverRows,
  calculateSearchPopoverPosition,
  nextEnabledOptionIndex,
  type SearchPopoverOption,
  type SearchPopoverOrganization,
  type SearchPopoverPosition
} from "@/shared/ui/searchPopover";

export function SearchPopoverPicker<T>({
  label,
  placeholder,
  options,
  organization,
  selectedId,
  disabled = false,
  loading = false,
  emptyMessage = "No matching options.",
  required = false,
  invalid = false,
  ariaDescribedBy,
  onSelect
}: {
  label: string;
  placeholder: string;
  options: SearchPopoverOption<T>[];
  organization?: SearchPopoverOrganization;
  selectedId?: string | null;
  disabled?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  required?: boolean;
  invalid?: boolean;
  ariaDescribedBy?: string;
  onSelect: (value: T) => void;
}): JSX.Element {
  const generatedId = useId().replace(/:/g, "");
  const inputId = `search-picker-${generatedId}`;
  const listboxId = `${inputId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [position, setPosition] = useState<SearchPopoverPosition | null>(null);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(() => new Set());
  const collapsedFolderIds = useMemo(
    () =>
      new Set(
        organization?.folders
          .map((folder) => folder.id)
          .filter((folderId) => !expandedFolderIds.has(folderId)) ?? []
      ),
    [expandedFolderIds, organization]
  );
  const visibleRows = useMemo(
    () =>
      buildOrganizedSearchPopoverRows({
        options,
        organization,
        query,
        collapsedFolderIds
      }),
    [collapsedFolderIds, options, organization, query]
  );
  const visibleOptions = useMemo(
    () => visibleRows.flatMap((row) => (row.type === "option" ? [row.option] : [])),
    [visibleRows]
  );
  const activeOption = activeIndex >= 0 ? visibleOptions[activeIndex] : undefined;

  const close = useCallback((): void => {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
    setPosition(null);
  }, []);

  const updatePosition = useCallback((): void => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    setPosition(
      calculateSearchPopoverPosition({
        anchor: input.getBoundingClientRect(),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      })
    );
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node | null;
      if (rootRef.current?.contains(target) || popupRef.current?.contains(target)) {
        return;
      }
      close();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [close, open]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [expandedFolderIds, options, organization, query]);

  useEffect(() => {
    if (!open || activeIndex < 0) {
      return;
    }
    popupRef.current
      ?.querySelector<HTMLElement>(`[data-option-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const selectOption = (option: SearchPopoverOption<T> | undefined): void => {
    if (!option || option.disabledReason) {
      return;
    }
    onSelect(option.value);
    close();
  };

  const moveActive = (direction: "next" | "previous" | "first" | "last"): void => {
    setOpen(true);
    setActiveIndex((currentIndex) =>
      nextEnabledOptionIndex({ options: visibleOptions, currentIndex, direction })
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive("next");
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive("previous");
      return;
    }
    if (event.key === "Home" && open) {
      event.preventDefault();
      moveActive("first");
      return;
    }
    if (event.key === "End" && open) {
      event.preventDefault();
      moveActive("last");
      return;
    }
    if (event.key === "Enter" && open && activeOption) {
      event.preventDefault();
      selectOption(activeOption);
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      close();
    }
  };

  const popupStyle: CSSProperties | undefined = position
    ? {
        top: position.top,
        left: position.left,
        width: position.width,
        maxHeight: position.maxHeight
      }
    : undefined;

  return (
    <div
      className="search-popover-picker"
      ref={rootRef}
      onBlur={() => {
        requestAnimationFrame(() => {
          const focused = document.activeElement;
          if (rootRef.current?.contains(focused) || popupRef.current?.contains(focused)) {
            return;
          }
          close();
        });
      }}
    >
      <label className={`field${invalid ? " field--invalid" : ""}`} htmlFor={inputId}>
        <span className="field__label">
          {label}
          {required ? (
            <>
              <span className="field__required-marker" aria-hidden="true">
                *
              </span>
              <span className="r6-sr-only"> (required)</span>
            </>
          ) : null}
        </span>
        <input
          id={inputId}
          ref={inputRef}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
          }
          aria-invalid={invalid}
          aria-describedby={ariaDescribedBy}
          required={required}
          value={
            open ? query : (options.find((option) => option.id === selectedId)?.label ?? query)
          }
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => {
            if (!disabled) setOpen(true);
          }}
          onClick={() => {
            if (!disabled) setOpen(true);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
      </label>

      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              className="search-popover-picker__popup"
              ref={popupRef}
              style={popupStyle}
              id={listboxId}
              role="listbox"
              aria-label={label}
            >
              {loading ? (
                <div className="search-popover-picker__status">Loading options...</div>
              ) : null}
              {!loading && visibleRows.length === 0 ? (
                <div className="search-popover-picker__status">{emptyMessage}</div>
              ) : null}
              {!loading
                ? visibleRows.map((row) => {
                    if (row.type === "folder") {
                      return (
                        <button
                          type="button"
                          className="search-popover-picker__folder"
                          key={`folder:${row.id}`}
                          aria-expanded={row.expanded}
                          style={{ paddingInlineStart: `${0.65 + row.depth * 0.8}rem` }}
                          onPointerDown={(event) => event.preventDefault()}
                          onClick={() =>
                            setExpandedFolderIds((current) => {
                              const next = new Set(current);
                              if (next.has(row.id)) {
                                next.delete(row.id);
                              } else {
                                next.add(row.id);
                              }
                              return next;
                            })
                          }
                        >
                          <span aria-hidden="true">{row.expanded ? "▾" : "▸"}</span>
                          <strong>{row.name}</strong>
                        </button>
                      );
                    }
                    const option = row.option;
                    const index = visibleOptions.indexOf(option);
                    const active = index === activeIndex;
                    return (
                      <div
                        id={`${listboxId}-option-${index}`}
                        className={`search-popover-picker__option ${
                          active ? "search-popover-picker__option--active" : ""
                        } ${option.disabledReason ? "search-popover-picker__option--disabled" : ""}`}
                        key={option.id}
                        role="option"
                        aria-selected={active}
                        aria-disabled={Boolean(option.disabledReason)}
                        data-option-index={index}
                        style={{ paddingInlineStart: `${0.65 + row.depth * 0.8}rem` }}
                        onPointerEnter={() => setActiveIndex(index)}
                        onPointerDown={(event) => event.preventDefault()}
                        onClick={() => selectOption(option)}
                      >
                        <div className="search-popover-picker__option-top">
                          <strong>{option.label}</strong>
                          {option.disabledReason ? (
                            <span className="muted">{option.disabledReason}</span>
                          ) : null}
                        </div>
                        {option.secondary ? (
                          <span className="muted search-popover-picker__secondary">
                            {option.secondary}
                          </span>
                        ) : null}
                      </div>
                    );
                  })
                : null}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
