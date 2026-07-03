import type { ReactElement } from "react";
import { StudyIcon } from "./StudyIcon";
import type { QuickRollItem } from "./types";

export function QuickRollDock({ items }: { items: readonly QuickRollItem[] }): ReactElement | null {
  if (!items.length) return null;

  return (
    <nav className="cs-quick-dock" aria-label="Quick rolls">
      {items.slice(0, 4).map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => void item.onTrigger?.()}
          disabled={item.pending || Boolean(item.disabledReason) || !item.onTrigger}
          title={item.disabledReason}
          aria-label={item.disabledReason ? `${item.label}. Unavailable: ${item.disabledReason}` : item.label}
        >
          <StudyIcon name="dice" />
          <span>{item.shortLabel ?? item.label}</span>
        </button>
      ))}
    </nav>
  );
}
