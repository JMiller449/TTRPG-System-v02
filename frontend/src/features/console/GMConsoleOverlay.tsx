import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import { EncounterQuickSelectPanel } from "@/features/encounters/EncounterQuickSelectPanel";
import { GM_NAV_ITEMS, isGMOverlayShortcut } from "@/features/console/gmNavigation";
import { StateSafetyPanel } from "@/features/stateSync/StateSafetyPanel";
import type { GameClient } from "@/hooks/useGameClient";

export function GMConsoleOverlay({ client }: { client: GameClient }): JSX.Element {
  const {
    state: {
      uiState: { gmView }
    },
    dispatch
  } = useAppStore();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isGMOverlayShortcut(event)) {
        event.preventDefault();
        setOpen((current) => {
          if (current) {
            window.requestAnimationFrame(() => triggerRef.current?.focus());
          }
          return !current;
        });
        return;
      }
      if (event.key === "Escape") {
        setOpen(false);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const close = (): void => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const keepFocusInDialog = (event: ReactKeyboardEvent<HTMLElement>): void => {
    if (event.key !== "Tab") {
      return;
    }
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable?.length) {
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
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="button gm-command-trigger"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="gm-command-overlay"
        title="Open GM quick controls (Alt+G)"
      >
        GM Quick Controls
      </button>

      {open ? (
        <div
          className="gm-command-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              close();
            }
          }}
        >
          <section
            ref={dialogRef}
            className="gm-command-overlay"
            id="gm-command-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gm-command-title"
            onKeyDown={keepFocusInDialog}
          >
            <header className="gm-command-overlay__header">
              <div>
                <h2 id="gm-command-title">GM Quick Controls</h2>
                <p className="muted">Switch pages or spawn a saved encounter. Shortcut: Alt+G.</p>
              </div>
              <button type="button" className="button button--secondary" onClick={close} autoFocus>
                Close
              </button>
            </header>

            <nav className="gm-command-overlay__nav" aria-label="GM quick page navigation">
              {GM_NAV_ITEMS.map((item) => (
                <button
                  key={item.view}
                  type="button"
                  className={`tab ${gmView === item.view ? "tab--active" : ""}`}
                  aria-current={gmView === item.view ? "page" : undefined}
                  onClick={() => {
                    dispatch({ type: "set_gm_view", view: item.view });
                    close();
                  }}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <EncounterQuickSelectPanel client={client} />
            <StateSafetyPanel client={client} />
          </section>
        </div>
      ) : null}
    </>
  );
}
