import { ModalDialog } from "@/shared/ui/ModalDialog";

export function ActionPointRefillDialog({
  actionName,
  characterName,
  maximumPoints,
  onConfirm,
  onClose
}: {
  actionName: string;
  characterName: string;
  maximumPoints: number;
  onConfirm: () => void;
  onClose: () => void;
}): JSX.Element {
  return (
    <ModalDialog
      title="Refill action points?"
      description={`${characterName} has no action/reaction points available for ${actionName}.`}
      onClose={onClose}
    >
      <p>
        Refill the pool to {maximumPoints} and continue using <strong>{actionName}</strong>?
      </p>
      <div className="r6-modal__actions">
        <button className="button" type="button" onClick={onConfirm}>
          Refill and continue
        </button>
        <button className="button button--secondary" type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </ModalDialog>
  );
}
