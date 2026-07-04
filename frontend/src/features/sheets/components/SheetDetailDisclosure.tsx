import type { ReactNode } from "react";

export function SheetDetailDisclosure({
  title,
  count,
  children
}: {
  title: string;
  count?: number;
  children: ReactNode;
}): JSX.Element {
  return (
    <details className="sheet-detail-disclosure">
      <summary>
        <strong>{title}</strong>
        {count === undefined ? null : <span className="muted">{count}</span>}
      </summary>
      <div className="sheet-detail-disclosure__body">{children}</div>
    </details>
  );
}
