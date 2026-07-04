import type { ReactNode } from "react";

export function Panel({
  title,
  actions,
  className,
  children
}: {
  title: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className={`panel${className ? ` ${className}` : ""}`}>
      <header className="panel__header">
        <h2>{title}</h2>
        {actions ? <div className="panel__actions">{actions}</div> : null}
      </header>
      <div className="panel__body">{children}</div>
    </section>
  );
}
