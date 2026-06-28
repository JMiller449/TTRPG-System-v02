import type { ActionRollMode } from "@/infrastructure/ws/requestBuilders";
import type { ActionRollModeKind } from "@/domain/models";
import { actionRollModes } from "@/features/rolls/actionRollModes";

const ROLL_MODE_LABELS: Record<ActionRollMode, string> = {
  normal: "Normal",
  advantage: "Advantage",
  disadvantage: "Disadvantage",
  critical: "Critical"
};

export function RollModeControl({
  value,
  modeKind,
  onChange
}: {
  value: ActionRollMode;
  modeKind: ActionRollModeKind;
  onChange: (mode: ActionRollMode) => void;
}): JSX.Element | null {
  const modes = actionRollModes(modeKind);
  if (modes.length === 1) {
    return null;
  }
  return (
    <div className="roll-mode-control" role="group" aria-label="Roll mode">
      {modes.map((mode) => (
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
