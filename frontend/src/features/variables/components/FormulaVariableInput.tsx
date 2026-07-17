import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type SyntheticEvent
} from "react";
import { createPortal } from "react-dom";
import { Field } from "@/shared/ui/Field";
import {
  calculateSearchPopoverPosition,
  filterSearchPopoverOptions,
  nextEnabledOptionIndex,
  type SearchPopoverOption,
  type SearchPopoverPosition
} from "@/shared/ui/searchPopover";
import {
  activeFormulaMention,
  replaceFormulaMention,
  type ActiveFormulaMention
} from "@/features/variables/formulaVariableMention";

export function FormulaVariableInput<T extends { token: string }>({
  label,
  value,
  options,
  onChange,
  onVariableSelect,
  multiline = true,
  rows = 3,
  placeholder,
  disabled = false,
  loading = false,
  emptyMessage = "No matching variables.",
  ariaInvalid
}: {
  label: string;
  value: string;
  options: SearchPopoverOption<T>[];
  onChange: (value: string) => void;
  onVariableSelect: (entry: T, nextText: string) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  ariaInvalid?: boolean;
}): JSX.Element {
  const generatedId = useId().replace(/:/g, "");
  const inputId = `formula-variable-${generatedId}`;
  const listboxId = `${inputId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [mention, setMention] = useState<ActiveFormulaMention | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<SearchPopoverPosition | null>(null);
  const visibleOptions = useMemo(
    () => filterSearchPopoverOptions(options, mention?.query ?? ""),
    [mention?.query, options]
  );
  const open = mention !== null;

  const close = useCallback((): void => {
    setMention(null);
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

  const updateMention = (text: string, cursor: number | null): void => {
    const nextMention = activeFormulaMention(text, cursor ?? text.length);
    setMention(nextMention);
    setActiveIndex(0);
    if (nextMention) {
      requestAnimationFrame(updatePosition);
    }
  };

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
    if (!open || activeIndex < 0) {
      return;
    }
    popupRef.current
      ?.querySelector<HTMLElement>(`[data-option-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const selectOption = (option: SearchPopoverOption<T> | undefined): void => {
    if (!option || option.disabledReason || !mention) {
      return;
    }
    const replacement = replaceFormulaMention(value, mention, option.value.token);
    onVariableSelect(option.value, replacement.text);
    close();
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(replacement.cursor, replacement.cursor);
    });
  };

  const moveActive = (direction: "next" | "previous" | "first" | "last"): void => {
    setActiveIndex((currentIndex) =>
      nextEnabledOptionIndex({ options: visibleOptions, currentIndex, direction })
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    if (!open) {
      return;
    }
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
    if (event.key === "Home") {
      event.preventDefault();
      moveActive("first");
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      moveActive("last");
      return;
    }
    if ((event.key === "Enter" || event.key === "Tab") && visibleOptions[activeIndex]) {
      event.preventDefault();
      selectOption(visibleOptions[activeIndex]);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  const refreshMentionFromSelection = (
    event: SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>
  ): void => {
    const target = event.currentTarget;
    updateMention(target.value, target.selectionStart);
  };

  const sharedProps = {
    id: inputId,
    ref: (node: HTMLInputElement | HTMLTextAreaElement | null) => {
      inputRef.current = node;
    },
    value,
    disabled,
    placeholder,
    role: "combobox",
    "aria-autocomplete": "list" as const,
    "aria-expanded": open,
    "aria-controls": listboxId,
    "aria-activedescendant":
      open && visibleOptions[activeIndex]
        ? `${listboxId}-option-${activeIndex}`
        : undefined,
    "aria-invalid": ariaInvalid,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange(event.target.value);
      updateMention(event.target.value, event.target.selectionStart);
    },
    onKeyDown,
    onClick: refreshMentionFromSelection,
    onKeyUp: (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        refreshMentionFromSelection(event);
      }
    },
    onBlur: () => {
      requestAnimationFrame(() => {
        const focused = document.activeElement;
        if (rootRef.current?.contains(focused) || popupRef.current?.contains(focused)) {
          return;
        }
        close();
      });
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
    <div className="formula-variable-input" ref={rootRef}>
      <Field label={label}>
        {multiline ? (
          <textarea {...sharedProps} rows={rows} />
        ) : (
          <input {...sharedProps} />
        )}
      </Field>
      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              className="search-popover-picker__popup"
              ref={popupRef}
              style={popupStyle}
              id={listboxId}
              role="listbox"
              aria-label={`${label} variables`}
            >
              {loading ? (
                <div className="search-popover-picker__status">Loading variables...</div>
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
                        <span>{option.label}</span>
                        {option.secondary ? <small>{option.secondary}</small> : null}
                        {option.disabledReason ? <small>{option.disabledReason}</small> : null}
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
