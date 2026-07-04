import type { ReactNode } from "react";

export function Panel({
  title,
  subtitle,
  actions,
  className,
  children
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className={`panel${className ? ` ${className}` : ""}`}>
      <header className="panel__header">
        <div className="panel__heading">
          <h2>{title}</h2>
          {subtitle ? <p className="panel__subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="panel__actions">{actions}</div> : null}
      </header>
      <div className="panel__body">{children}</div>
    </section>
  );
}
