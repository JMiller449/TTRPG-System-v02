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
  calculateSearchPopoverPosition,
  filterSearchPopoverOptions,
  nextEnabledOptionIndex,
  type SearchPopoverOption,
  type SearchPopoverPosition
} from "@/shared/ui/searchPopover";

export function SearchPopoverPicker<T>({
  label,
  placeholder,
  options,
  loading = false,
  emptyMessage = "No matching options.",
  onSelect
}: {
  label: string;
  placeholder: string;
  options: SearchPopoverOption<T>[];
  loading?: boolean;
  emptyMessage?: string;
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
  const visibleOptions = useMemo(
    () => filterSearchPopoverOptions(options, query),
    [options, query]
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
  }, [query, options]);

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
      <label className="field" htmlFor={inputId}>
        <span className="field__label">{label}</span>
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
          value={query}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
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
              {!loading && visibleOptions.length === 0 ? (
                <div className="search-popover-picker__status">{emptyMessage}</div>
              ) : null}
              {!loading
                ? visibleOptions.map((option, index) => {
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
