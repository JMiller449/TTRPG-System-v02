import { useEffect, useId, useRef, type ReactElement, type ReactNode } from "react";

export interface SystemModalProps {
  open: boolean;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
}

export function SystemModal({ open, title, eyebrow = "System Notification", children, actions, onClose }: SystemModalProps): ReactElement | null {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    requestAnimationFrame(() => dialogRef.current?.focus());
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="r6-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div ref={dialogRef} className="r6-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <button type="button" className="r6-modal__close" onClick={onClose} aria-label="Close dialog">×</button>
        <div className="r6-modal__sigil" aria-hidden="true"><span>!</span></div>
        <p className="r6-kicker">{eyebrow}</p>
        <h2 id={titleId}>{title}</h2>
        <div className="r6-modal__body">{children}</div>
        {actions ? <div className="r6-modal__actions">{actions}</div> : null}
      </div>
    </div>
  );
}
