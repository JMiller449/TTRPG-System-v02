import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from "react";

export function ModalDialog({
  title,
  description,
  pending = false,
  size = "compact",
  children,
  onClose
}: {
  title: string;
  description: string;
  pending?: boolean;
  size?: "compact" | "large";
  children: ReactNode;
  onClose: () => void;
}): JSX.Element {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Tab") {
        const focusable = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          ) ?? []
        );
        if (focusable.length === 0) {
          event.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      if (event.key !== "Escape" || pending) {
        return;
      }
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose, pending]);

  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>): void => {
    if (event.target === event.currentTarget && !pending) {
      onClose();
    }
  };

  return (
    <div className="r6-modal-backdrop template-contextual-modal" onMouseDown={closeFromBackdrop}>
      <section
        ref={dialogRef}
        className={`r6-modal template-contextual-modal__dialog template-contextual-modal__dialog--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <button
          ref={closeButtonRef}
          type="button"
          className="r6-modal__close"
          aria-label={`Close ${title}`}
          disabled={pending}
          onClick={onClose}
        >
          ×
        </button>
        <header className="template-contextual-modal__heading">
          <h2 id={titleId}>{title}</h2>
          <p id={descriptionId} className="muted">
            {description}
          </p>
        </header>
        <div className="template-contextual-modal__body">{children}</div>
      </section>
    </div>
  );
}
