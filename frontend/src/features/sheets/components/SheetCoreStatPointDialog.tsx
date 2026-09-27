import { useState, type FormEvent } from "react";
import { DISPLAY_NAMES, type CoreStatKey } from "@/domain/stats";
import { Field } from "@/shared/ui/Field";
import { ModalDialog } from "@/shared/ui/ModalDialog";

export interface PointAdjustmentSubmission {
  quantity: number;
  operation: "add" | "remove";
  source: "manual" | "level_up";
  reason: string;
}

function PointAdjustmentDialog({
  title,
  description,
  initialOperation = "add",
  maximumRemoval,
  allowOperationChoice = false,
  onSubmit,
  onClose
}: {
  title: string;
  description: string;
  initialOperation?: "add" | "remove";
  maximumRemoval?: number;
  allowOperationChoice?: boolean;
  onSubmit: (value: PointAdjustmentSubmission) => void;
  onClose: () => void;
}): JSX.Element {
  const [quantity, setQuantity] = useState("1");
  const [operation, setOperation] = useState<"add" | "remove">(initialOperation);
  const [source, setSource] = useState<"manual" | "level_up">("level_up");
  const [reason, setReason] = useState("");
  const parsedQuantity = Number(quantity);
  const valid =
    Number.isSafeInteger(parsedQuantity) &&
    parsedQuantity > 0 &&
    (operation !== "remove" || maximumRemoval === undefined || parsedQuantity <= maximumRemoval);

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!valid) return;
    onSubmit({
      quantity: parsedQuantity,
      operation,
      source: operation === "remove" ? "manual" : source,
      reason: reason.trim()
    });
  };

  return (
    <ModalDialog title={title} description={description} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        {allowOperationChoice ? (
          <Field label="Adjustment">
            <select
              value={operation}
              onChange={(event) => setOperation(event.target.value as "add" | "remove")}
            >
              <option value="add">Add points</option>
              <option value="remove">Remove points</option>
            </select>
          </Field>
        ) : null}
        <Field label={operation === "add" ? "Points to add" : "Points to remove"}>
          <input
            type="number"
            min={1}
            max={operation === "remove" ? maximumRemoval : undefined}
            step={1}
            inputMode="numeric"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            autoFocus
          />
        </Field>
        {operation === "add" ? (
          <Field label="Award source">
            <select
              value={source}
              onChange={(event) => setSource(event.target.value as "manual" | "level_up")}
            >
              <option value="level_up">Level-up award</option>
              <option value="manual">Manual grant</option>
            </select>
          </Field>
        ) : null}
        <Field label="Audit note">
          <input
            value={reason}
            maxLength={1000}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        <div className="inline-actions">
          <button className="button" type="submit" disabled={!valid}>
            {operation === "add" ? "Add" : "Remove"} {valid ? parsedQuantity : 0} Point
            {parsedQuantity === 1 ? "" : "s"}
          </button>
          <button className="button button--secondary" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}

export function SheetCoreStatPointDialog({
  statName,
  currentBase,
  onSubmit,
  onClose
}: {
  statName: CoreStatKey;
  currentBase: number;
  onSubmit: (value: PointAdjustmentSubmission) => void;
  onClose: () => void;
}): JSX.Element {
  return (
    <PointAdjustmentDialog
      title={`Adjust points for ${DISPLAY_NAMES[statName]}`}
      description={`Permanent base: ${currentBase}. Active augmentations remain separate.`}
      allowOperationChoice
      onSubmit={onSubmit}
      onClose={onClose}
    />
  );
}

export function SheetUnspentPointAdjustmentDialog({
  currentUnspent,
  operation = "add",
  onSubmit,
  onClose
}: {
  currentUnspent: number;
  operation?: "add" | "remove";
  onSubmit: (value: PointAdjustmentSubmission) => void;
  onClose: () => void;
}): JSX.Element {
  return (
    <PointAdjustmentDialog
      title={operation === "add" ? "Grant Unspent Points" : "Remove Unspent Points"}
      description={
        operation === "add"
          ? `Current unspent pool: ${currentUnspent}. The player can assign granted points later.`
          : `Current unspent pool: ${currentUnspent}. Remove points added by mistake.`
      }
      initialOperation={operation}
      maximumRemoval={currentUnspent}
      onSubmit={onSubmit}
      onClose={onClose}
    />
  );
}
