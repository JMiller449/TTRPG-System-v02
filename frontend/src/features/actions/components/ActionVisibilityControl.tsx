import type { ActionExecutionVisibility } from "@/infrastructure/ws/requestBuilders";

const VISIBILITY_LABELS: Record<ActionExecutionVisibility, string> = {
  public: "Public",
  gm: "GM Only"
};

export function ActionVisibilityControl({
  value,
  onChange
}: {
  value: ActionExecutionVisibility;
  onChange: (visibility: ActionExecutionVisibility) => void;
}): JSX.Element {
  return (
    <div className="roll-mode-control" role="group" aria-label="Roll20 visibility">
      {(["public", "gm"] as const).map((visibility) => (
        <button
          className={`roll-mode-control__option ${
            value === visibility ? "roll-mode-control__option--active" : ""
          }`}
          type="button"
          aria-pressed={value === visibility}
          key={visibility}
          onClick={() => onChange(visibility)}
        >
          {VISIBILITY_LABELS[visibility]}
        </button>
      ))}
    </div>
  );
}
