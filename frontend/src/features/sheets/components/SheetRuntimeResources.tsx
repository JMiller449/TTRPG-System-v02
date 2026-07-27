import { useState } from "react";
import { Field } from "@/shared/ui/Field";

function formatFraction(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "");
}

export function SheetReactionResource({
  current,
  maximum,
  canManage,
  onSpend,
  onRestore,
  onReset
}: {
  current: number;
  maximum: number;
  canManage: boolean;
  onSpend: () => void;
  onRestore: () => void;
  onReset: () => void;
}): JSX.Element {
  const canConsume = current >= 1;
  const canRestore = current + 1 <= maximum;
  const canReset = current !== maximum;

  return (
    <section className="character-sheet__section character-sheet__section--compact">
      <h4>Action / Reaction Points</h4>
      <div className="inline-actions">
        <p className="muted">
          {formatFraction(current)} / {formatFraction(maximum)} available
        </p>
        {canManage ? (
          <>
            <button
              className="button button--secondary"
              type="button"
              disabled={!canConsume}
              onClick={onSpend}
            >
              Spend
            </button>
            <button
              className="button button--secondary"
              type="button"
              disabled={!canRestore}
              onClick={onRestore}
            >
              Restore
            </button>
            <button className="button" type="button" disabled={!canReset} onClick={onReset}>
              Reset
            </button>
          </>
        ) : null}
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
