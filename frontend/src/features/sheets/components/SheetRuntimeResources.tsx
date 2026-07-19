import { useState } from "react";
import { Field } from "@/shared/ui/Field";

function formatFraction(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "");
}

export function SheetReactionResource({
  current,
  maximum,
  onAdjust,
  onReset
}: {
  current: number;
  maximum: number;
  onAdjust: (delta: number) => void;
  onReset: () => void;
}): JSX.Element {
  const [amount, setAmount] = useState("0.5");
  const parsedAmount = Number(amount);
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;

  return (
    <section className="character-sheet__section character-sheet__section--compact">
      <h4>Reactions</h4>
      <p className="muted">
        {formatFraction(current)} / {formatFraction(maximum)} available
      </p>
      <div className="inline-actions">
        <Field label="Amount">
          <input
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>
        <button
          className="button button--secondary"
          type="button"
          disabled={!validAmount}
          onClick={() => onAdjust(-parsedAmount)}
        >
          Spend
        </button>
        <button
          className="button button--secondary"
          type="button"
          disabled={!validAmount}
          onClick={() => onAdjust(parsedAmount)}
        >
          Restore
        </button>
        <button className="button" type="button" onClick={onReset}>
          Reset
        </button>
      </div>
    </section>
  );
}

export function SheetContributionPoints({
  value,
  canManage,
  onSet,
  onAdjust
}: {
  value: number;
  canManage: boolean;
  onSet: (value: number) => void;
  onAdjust: (delta: number) => void;
}): JSX.Element {
  const [amount, setAmount] = useState("0");
  const parsedAmount = Number(amount);
  const validAmount = Number.isInteger(parsedAmount) && parsedAmount >= 0;
  return (
    <section className="character-sheet__section character-sheet__section--compact">
      <h4>Contribution Points</h4>
      <p className="muted">
        Current balance: <strong>{value}</strong>
      </p>
      {canManage ? (
        <div className="inline-actions">
          <Field label="Whole points">
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </Field>
          <button
            className="button button--secondary"
            type="button"
            disabled={!validAmount}
            onClick={() => onAdjust(parsedAmount)}
          >
            Add
          </button>
          <button
            className="button button--secondary"
            type="button"
            disabled={!validAmount || parsedAmount > value}
            onClick={() => onAdjust(-parsedAmount)}
          >
            Subtract
          </button>
          <button
            className="button"
            type="button"
            disabled={!validAmount}
            onClick={() => onSet(parsedAmount)}
          >
            Set
          </button>
        </div>
      ) : null}
    </section>
  );
}
