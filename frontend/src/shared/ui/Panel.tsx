import type { ReactNode } from "react";

export function Panel({
  title,
  subtitle,
  actions,
  className,
  variant = "default",
  children
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  variant?: "default" | "frameless" | "workspace";
  children: ReactNode;
}): JSX.Element {
  const panelClassName = [
    "panel",
    variant === "default" ? "" : `panel--${variant}`,
    className ?? ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={panelClassName} aria-label={variant === "frameless" ? title : undefined}>
      {variant !== "frameless" ? (
        <header className="panel__header">
          <div className="panel__heading">
            <h2>{title}</h2>
            {subtitle ? <p className="panel__subtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div className="panel__actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="panel__body">{children}</div>
    </section>
  );
}
