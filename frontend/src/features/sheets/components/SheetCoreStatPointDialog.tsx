import { useState, type FormEvent } from "react";
import { DISPLAY_NAMES, type CoreStatKey } from "@/domain/stats";
import { Field } from "@/shared/ui/Field";
import { ModalDialog } from "@/shared/ui/ModalDialog";

export interface PointGrantSubmission {
  quantity: number;
  source: "manual" | "level_up";
  reason: string;
}

function PointGrantDialog({
  title,
  description,
  onSubmit,
  onClose
}: {
  title: string;
  description: string;
  onSubmit: (value: PointGrantSubmission) => void;
  onClose: () => void;
}): JSX.Element {
  const [quantity, setQuantity] = useState("1");
  const [source, setSource] = useState<"manual" | "level_up">("level_up");
  const [reason, setReason] = useState("");
  const parsedQuantity = Number(quantity);
  const valid = Number.isSafeInteger(parsedQuantity) && parsedQuantity > 0;

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!valid) return;
    onSubmit({ quantity: parsedQuantity, source, reason: reason.trim() });
  };

  return (
    <ModalDialog title={title} description={description} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <Field label="Points to add">
          <input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Award source">
          <select
            value={source}
            onChange={(event) => setSource(event.target.value as "manual" | "level_up")}
          >
            <option value="level_up">Level-up award</option>
            <option value="manual">Manual grant</option>
          </select>
        </Field>
        <Field label="Audit note">
          <input
            value={reason}
            maxLength={1000}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        <div className="inline-actions">
          <button className="button" type="submit" disabled={!valid}>
            Add {valid ? parsedQuantity : 0} Point{parsedQuantity === 1 ? "" : "s"}
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
  onSubmit: (value: PointGrantSubmission) => void;
  onClose: () => void;
}): JSX.Element {
  return (
    <PointGrantDialog
      title={`Add points to ${DISPLAY_NAMES[statName]}`}
      description={`Permanent base: ${currentBase}. Active augmentations remain separate.`}
      onSubmit={onSubmit}
      onClose={onClose}
    />
  );
}

export function SheetUnspentPointGrantDialog({
  currentUnspent,
  onSubmit,
  onClose
}: {
  currentUnspent: number;
  onSubmit: (value: PointGrantSubmission) => void;
  onClose: () => void;
}): JSX.Element {
  return (
    <PointGrantDialog
      title="Grant Unspent Points"
      description={`Current unspent pool: ${currentUnspent}. The player can assign granted points later.`}
      onSubmit={onSubmit}
      onClose={onClose}
    />
  );
}
