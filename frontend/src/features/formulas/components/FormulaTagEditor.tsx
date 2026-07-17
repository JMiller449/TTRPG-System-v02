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
  addFormulaTags,
  COMMON_FORMULA_TAGS,
  normalizeFormulaTag,
  normalizeFormulaTags,
  removeFormulaTag
} from "@/features/formulas/formulaTags";
import {
  calculateSearchPopoverPosition,
  filterSearchPopoverOptions,
  nextEnabledOptionIndex,
  type SearchPopoverOption,
  type SearchPopoverPosition
} from "@/shared/ui/searchPopover";

export function FormulaTagEditor({
  tags,
  onChange,
  label = "Formula Tags",
  suggestions = COMMON_FORMULA_TAGS
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  label?: string;
  suggestions?: string[];
}): JSX.Element {
  const generatedId = useId().replace(/:/g, "");
  const inputId = `formula-tags-${generatedId}`;
  const listboxId = `${inputId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<SearchPopoverPosition | null>(null);
  const normalizedTags = normalizeFormulaTags(tags);
  const normalizedSuggestions = useMemo(() => normalizeFormulaTags(suggestions), [suggestions]);
  const suggestionOptions = useMemo<SearchPopoverOption<string>[]>(
    () =>
      normalizedSuggestions
        .filter((tag) => !normalizedTags.includes(tag))
        .map((tag) => ({ id: `suggested-${tag}`, label: tag, value: tag })),
    [normalizedSuggestions, normalizedTags]
  );
  const filteredSuggestions = useMemo(
    () => filterSearchPopoverOptions(suggestionOptions, draft),
    [draft, suggestionOptions]
  );
  const customTag = normalizeFormulaTag(draft);
  const canCreateCustomTag = Boolean(
    customTag &&
      !normalizedTags.includes(customTag) &&
      !normalizedSuggestions.includes(customTag)
  );
  const visibleOptions = useMemo<SearchPopoverOption<string>[]>(
    () =>
      canCreateCustomTag
        ? [
            ...filteredSuggestions,
            {
              id: `custom-${customTag}`,
              label: customTag,
              secondary: "Create custom tag",
              value: customTag
            }
          ]
        : filteredSuggestions,
    [canCreateCustomTag, customTag, filteredSuggestions]
  );

  const close = useCallback((): void => {
    setOpen(false);
    setActiveIndex(0);
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

  const showOptions = (): void => {
    setOpen(true);
    requestAnimationFrame(updatePosition);
  };

  useEffect(() => {
    setActiveIndex(0);
  }, [draft, tags, suggestions]);

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

  const selectTag = (tag: string): void => {
    const nextTags = addFormulaTags(normalizedTags, tag);
    if (
      nextTags.length !== normalizedTags.length ||
      !nextTags.every((value, index) => value === normalizedTags[index])
    ) {
      onChange(nextTags);
    }
    setDraft("");
    setOpen(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      updatePosition();
    });
  };

  const commitDraft = (): void => {
    if (draft.trim()) {
      selectTag(draft);
    }
  };

  const moveActive = (direction: "next" | "previous" | "first" | "last"): void => {
    setActiveIndex((currentIndex) =>
      nextEnabledOptionIndex({ options: visibleOptions, currentIndex, direction })
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      showOptions();
      moveActive("next");
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      showOptions();
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
    if ((event.key === "Enter" || (event.key === "Tab" && draft.trim())) && open) {
      event.preventDefault();
      const option = visibleOptions[activeIndex];
      if (option) {
        selectTag(option.value);
      } else {
        commitDraft();
      }
      return;
    }
    if (event.key === ",") {
      event.preventDefault();
      commitDraft();
      return;
    }
    if (event.key === "Backspace" && !draft && normalizedTags.length > 0) {
      onChange(normalizedTags.slice(0, -1));
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
      className="formula-tag-editor stack"
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
      <label className="field__label" htmlFor={inputId}>
        {label}
      </label>
      <div
        className="formula-tag-editor__control"
        onClick={() => inputRef.current?.focus()}
      >
        {normalizedTags.map((tag) => (
          <button
            className="formula-tag"
            type="button"
            key={tag}
            onClick={(event) => {
              event.stopPropagation();
              onChange(removeFormulaTag(normalizedTags, tag));
            }}
            aria-label={`Remove formula tag ${tag}`}
          >
            {tag} ×
          </button>
        ))}
        <input
          id={inputId}
          ref={inputRef}
          className="formula-tag-editor__input"
          value={draft}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={
            open && visibleOptions[activeIndex]
              ? `${listboxId}-option-${activeIndex}`
              : undefined
          }
          placeholder={normalizedTags.length > 0 ? "Add another tag" : "Search or add tags"}
          onFocus={showOptions}
          onClick={showOptions}
          onChange={(event) => {
            const nextDraft = event.target.value;
            if (nextDraft.includes(",")) {
              const parts = nextDraft.split(",");
              const remainder = parts.pop() ?? "";
              const nextTags = addFormulaTags(normalizedTags, parts.join(","));
              if (nextTags.length !== normalizedTags.length) {
                onChange(nextTags);
              }
              setDraft(remainder.trimStart());
            } else {
              setDraft(nextDraft);
            }
            showOptions();
          }}
          onKeyDown={onKeyDown}
        />
      </div>

      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              className="search-popover-picker__popup"
              ref={popupRef}
              style={popupStyle}
              id={listboxId}
              role="listbox"
              aria-label={`${label} suggestions`}
            >
              {visibleOptions.length === 0 ? (
                <div className="search-popover-picker__status">
                  All suggested tags are selected. Type to add a custom tag.
                </div>
              ) : (
                visibleOptions.map((option, index) => {
                  const active = index === activeIndex;
                  return (
                    <div
                      id={`${listboxId}-option-${index}`}
                      className={`search-popover-picker__option ${
                        active ? "search-popover-picker__option--active" : ""
                      }`}
                      key={option.id}
                      role="option"
                      aria-selected={active}
                      data-option-index={index}
                      onPointerEnter={() => setActiveIndex(index)}
                      onPointerDown={(event) => event.preventDefault()}
                      onClick={() => selectTag(option.value)}
                    >
                      <div className="search-popover-picker__option-top">
                        <strong>{option.label}</strong>
                      </div>
                      {option.secondary ? (
                        <span className="muted search-popover-picker__secondary">
                          {option.secondary}
                        </span>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
