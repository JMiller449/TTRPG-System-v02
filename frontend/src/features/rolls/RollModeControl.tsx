import type { ActionRollMode } from "@/infrastructure/ws/requestBuilders";
import { ACTION_ROLL_MODES } from "@/features/rolls/quickRolls";

const ROLL_MODE_LABELS: Record<ActionRollMode, string> = {
  normal: "Normal",
  advantage: "Advantage",
  disadvantage: "Disadvantage"
};

export function RollModeControl({
  value,
  onChange
}: {
  value: ActionRollMode;
  onChange: (mode: ActionRollMode) => void;
}): JSX.Element {
  return (
    <div className="roll-mode-control" role="group" aria-label="Roll mode">
      {ACTION_ROLL_MODES.map((mode) => (
        <button
          className={`roll-mode-control__option ${value === mode ? "roll-mode-control__option--active" : ""}`}
          type="button"
          aria-pressed={value === mode}
          key={mode}
          onClick={() => onChange(mode)}
        >
          {ROLL_MODE_LABELS[mode]}
        </button>
      ))}
    </div>
  );
}
