import { useState, type FormEvent } from "react";
import { Field } from "@/shared/ui/Field";
import { ModalDialog } from "@/shared/ui/ModalDialog";

export function InventoryQuantityDialog({
  itemName,
  currentCount,
  onChange,
  onClose
}: {
  itemName: string;
  currentCount: number;
  onChange: (count: number) => void;
  onClose: () => void;
}): JSX.Element {
  const [amount, setAmount] = useState("1");
  const parsedAmount = Number(amount);
  const validAmount = Number.isSafeInteger(parsedAmount) && parsedAmount > 0;
  const canAdd = validAmount && Number.isSafeInteger(currentCount + parsedAmount);

  const apply = (operation: "add" | "subtract"): void => {
    if (!validAmount || (operation === "add" && !canAdd)) return;
    onChange(
      operation === "add" ? currentCount + parsedAmount : Math.max(0, currentCount - parsedAmount)
    );
    onClose();
  };

  const submitAdd = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    apply("add");
  };

  return (
    <ModalDialog
      title={`Adjust ${itemName} quantity`}
      description="Add or subtract multiple items at once."
      onClose={onClose}
    >
      <form className="stack" onSubmit={submitAdd}>
        <div className="inventory-quantity-dialog__current">
          <strong>{currentCount}</strong>
        </div>
        <Field label="Amount">
          <input
            type="number"
            min={1}
            max={Number.MAX_SAFE_INTEGER}
            step={1}
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            autoFocus
          />
        </Field>
        {!canAdd && validAmount ? (
          <p className="error-text" role="alert">
            Adding this amount would exceed the maximum supported quantity.
          </p>
        ) : null}
        <div className="inline-actions">
          <button className="button" type="submit" disabled={!canAdd}>
            Add
          </button>
          <button
            className="button button--secondary"
            type="button"
            disabled={!validAmount}
            onClick={() => apply("subtract")}
          >
            Subtract
          </button>
          <button className="button button--secondary" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
